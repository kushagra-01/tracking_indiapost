/**
 * Server-side full report ZIP: queued jobs, throttled PDF generation, status polling.
 * One export runs at a time to keep CPU / India Post load predictable.
 */

const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { finished } = require("stream/promises");
const archiver = require("archiver");

const config = require("./config");
const { bulkTrack } = require("./indiaPostClient");
const { buildReportBuffer } = require("./report");
const { getConsignmentCategory } = require("./consignmentCategory");

/** @type {Map<string, object>} */
const jobs = new Map();

/** @type {string[]} */
let queue = [];
let pumpRunning = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildReadme(stats) {
  const lines = [
    "India Post — Full tracking export",
    "================================",
    "",
    `Generated (UTC): ${new Date().toISOString()}`,
    "",
    "Contents",
    "--------",
    "Excel/Master_Consignments.xlsx",
    "  • Same master workbook as Dashboard → XLSX (server-generated).",
    "  • Sheets: Consignments, All_Events, _Export_Info",
    "",
    "PDF/<Category>/<ARTICLE>.pdf",
    "  • Delivered, RTO_Return, In_Transit, Unknown — same PDF layout as single-article download",
    "",
    "Counts",
    "------",
    `Articles in Excel: ${stats.total}`,
    `PDF files generated: ${stats.pdfCount}`,
    `  Delivered: ${stats.byCat.Delivered}`,
    `  RTO_Return: ${stats.byCat.RTO_Return}`,
    `  In_Transit: ${stats.byCat.In_Transit}`,
    `  Unknown: ${stats.byCat.Unknown}`,
    "",
    "Note: Built server-side in a queued job (throttled) for stable load.",
    ""
  ];
  return lines.join("\r\n");
}

function singleItemTracking(full, item) {
  return {
    upstream_message: full.upstream_message || "",
    count: 1,
    items: [item]
  };
}

function touch(job, patch) {
  Object.assign(job, patch, { updatedAt: Date.now() });
}

function pruneJobs() {
  const ttl = config.exportFullJobTtlMs;
  const maxJobs = config.exportFullMaxJobs;
  const now = Date.now();
  for (const [id, job] of jobs) {
    const terminal = ["done", "failed", "cancelled"].includes(job.status);
    if (terminal && now - job.updatedAt > ttl) {
      if (job.filePath) {
        fsp.unlink(job.filePath).catch(() => {});
      }
      jobs.delete(id);
    }
  }
  if (jobs.size <= maxJobs) return;
  const sorted = [...jobs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  while (sorted.length && jobs.size > maxJobs) {
    const [id, job] = sorted.shift();
    if (job.filePath) fsp.unlink(job.filePath).catch(() => {});
    jobs.delete(id);
  }
}

function sanitizeJob(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    percent: job.percent,
    detail: job.detail,
    error: job.error,
    consignmentCount: job.consignments.length,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    downloadReady: job.status === "done" && Boolean(job.filePath),
    fileSize: job.fileSize ?? null
  };
}

async function runOneJob(job) {
  const id = job.id;
  const outPath = path.join(os.tmpdir(), `ip-full-export-${id}.zip`);
  job._outPath = outPath;

  touch(job, { status: "running", phase: "excel", percent: 2, detail: "Fetching tracking from India Post…" });

  if (job.abortRequested) {
    touch(job, { status: "cancelled", phase: "done", percent: 0, detail: "Cancelled before start", error: null });
    return;
  }

  let tracking;
  try {
    tracking = await bulkTrack(job.consignments);
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "Tracking fetch failed";
    touch(job, { status: "failed", phase: "error", percent: 0, detail: msg, error: msg });
    return;
  }

  const items = Array.isArray(tracking.items) ? tracking.items : [];

  const output = fs.createWriteStream(outPath);
  const archive = archiver("zip", { zlib: { level: 6 } });

  const failArch = (err) => {
    job._archiveError = err;
  };
  archive.on("error", failArch);

  archive.pipe(output);

  try {
    touch(job, { phase: "excel", percent: 4, detail: "Building master Excel…" });
    const xlsxBuf = await buildReportBuffer("xlsx", tracking);

    if (items.length) {
      archive.append(xlsxBuf, { name: "Excel/Master_Consignments.xlsx" });
    } else {
      archive.append(Buffer.from("No consignments to export.\r\n"), { name: "Excel/README.txt" });
    }

    const byCat = {
      Delivered: 0,
      RTO_Return: 0,
      In_Transit: 0,
      Unknown: 0
    };
    const total = items.length;

    touch(job, {
      phase: "pdf",
      percent: 5,
      detail: total ? `Generating PDFs (0/${total})…` : "No PDFs to generate"
    });

    for (let i = 0; i < items.length; i++) {
      if (job.abortRequested) {
        throw new Error("CANCELLED");
      }

      const it = items[i];
      const c = String(it.consignment || (it.booking_details && it.booking_details.article_number) || "")
        .trim()
        .toUpperCase();
      const cat = getConsignmentCategory(it.status);
      byCat[cat] += 1;

      touch(job, {
        phase: "pdf",
        percent: 5 + Math.round((85 * (i + 1)) / Math.max(total, 1)),
        detail: `PDF ${i + 1}/${total} — ${c}`
      });

      const pdfBuf = await buildReportBuffer("pdf", singleItemTracking(tracking, it));
      archive.append(pdfBuf, { name: `PDF/${cat}/${c}.pdf` });

      if (config.exportFullPdfGapMs > 0) await sleep(config.exportFullPdfGapMs);
      await new Promise((resolve) => setImmediate(resolve));
    }

    if (job.abortRequested) {
      throw new Error("CANCELLED");
    }

    archive.append(
      Buffer.from(
        buildReadme({
          total: items.length,
          pdfCount: total,
          byCat
        }),
        "utf8"
      ),
      { name: "README.txt" }
    );

    touch(job, { phase: "zip", percent: 92, detail: "Finalizing archive…" });

    await archive.finalize();
    await finished(output);

    if (job._archiveError) throw job._archiveError;

    const st = await fsp.stat(outPath);
    touch(job, {
      status: "done",
      phase: "done",
      percent: 100,
      detail: "Ready to download",
      error: null,
      filePath: outPath,
      fileSize: st.size
    });
  } catch (e) {
    const isCancel = e && (e.message === "CANCELLED" || job.abortRequested);
    try {
      archive.abort();
    } catch {
      /* ignore */
    }
    try {
      await fsp.unlink(outPath);
    } catch {
      /* ignore */
    }
    touch(job, {
      status: isCancel ? "cancelled" : "failed",
      phase: "error",
      error: isCancel ? null : e && e.message ? String(e.message) : "Export failed",
      detail: isCancel ? "Cancelled" : e && e.message ? String(e.message) : "Export failed",
      filePath: null,
      fileSize: null
    });
  }
}

async function pumpQueue() {
  if (pumpRunning) return;
  pumpRunning = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      const job = jobs.get(id);
      if (!job) continue;
      if (job.status === "cancelled") continue;
      await runOneJob(job);
      pruneJobs();
    }
  } finally {
    pumpRunning = false;
  }
}

function enqueue(id) {
  queue.push(id);
  setImmediate(() => pumpQueue());
}

/**
 * @param {string[]} consignments uppercased list
 * @returns {string} job id
 */
function createJob(consignments) {
  pruneJobs();
  const id = crypto.randomUUID();
  const job = {
    id,
    status: "queued",
    phase: null,
    percent: 0,
    detail: "Queued…",
    error: null,
    filePath: null,
    fileSize: null,
    consignments,
    abortRequested: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    _outPath: null,
    _archiveError: null
  };
  jobs.set(id, job);
  enqueue(id);
  return id;
}

function getJob(id) {
  return jobs.get(String(id || ""));
}

function listJobs() {
  pruneJobs();
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 25)
    .map(sanitizeJob);
}

function cancelJob(id) {
  const job = jobs.get(String(id || ""));
  if (!job) return false;
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") return false;
  job.abortRequested = true;
  if (job.status === "queued") {
    queue = queue.filter((qid) => qid !== id);
    touch(job, { status: "cancelled", phase: "done", percent: 0, detail: "Cancelled (was queued)", error: null });
  }
  touch(job, {});
  return true;
}

setInterval(() => pruneJobs(), 120_000).unref();

module.exports = {
  createJob,
  getJob,
  listJobs,
  cancelJob,
  sanitizeJob
};

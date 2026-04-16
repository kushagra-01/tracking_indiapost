/**
 * Tunables for large batch tracking and reporting.
 * Override via environment (see `.env.example`).
 */

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function nonNegIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

const maxConsignments = intEnv("MAX_CONSIGNMENTS", 100_000);

module.exports = {
  /** Express `express.json` limit (large paste / Excel-derived lists). */
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "10mb",

  /** Hard cap per request — protects memory and JSON parse time (raise via env if needed). */
  maxConsignments,

  /**
   * How many India Post bulk calls run at once (each call is up to 50 articles).
   * 1 = fully sequential (safest for rate limits). 2–4 can speed up large jobs.
   */
  indiapostChunkConcurrency: clamp(intEnv("INDIAPOST_CHUNK_CONCURRENCY", 1), 1, 8),

  /** Optional pause between concurrent wave completions (ms) — eases upstream rate limits. */
  indiapostChunkDelayMs: nonNegIntEnv("INDIAPOST_CHUNK_DELAY_MS", 0),

  /** Per-request timeout to India Post HTTP API (ms). */
  indiapostHttpTimeoutMs: intEnv("INDIAPOST_HTTP_TIMEOUT_MS", 60_000),

  /** Node HTTP server: max time for a request (ms). Large batches need this above default 5m in Node 18+. */
  serverRequestTimeoutMs: intEnv("SERVER_REQUEST_TIMEOUT_MS", 900_000),

  /** Pause between each PDF inside a full ZIP export (ms) — yields CPU and eases upstream load. */
  exportFullPdfGapMs: nonNegIntEnv("EXPORT_FULL_PDF_GAP_MS", 75),

  /** Drop completed export metadata / files after this age (ms). */
  exportFullJobTtlMs: intEnv("EXPORT_FULL_JOB_TTL_MS", 1_800_000),

  /** Max export jobs kept in memory (oldest pruned first). */
  exportFullMaxJobs: clamp(intEnv("EXPORT_FULL_MAX_JOBS", 40), 5, 500)
};

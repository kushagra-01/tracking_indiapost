/**
 * Public full-ZIP share links — MongoDB metadata + GridFS ZIP for multi-instance / serverless.
 */

const crypto = require("crypto");
const appSettings = require("./appSettings");
const { AppError } = require("./errors");
const { getExportSharesCollection } = require("./mongo");
const fullExportJob = require("./fullExportJob");
const shareZipStore = require("./shareZipStore");

function snapshotMeta(at = new Date()) {
  const snapshotDate = at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const snapshotDateLabel = at.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata"
  });
  return {
    generatedAt: at.getTime(),
    snapshotDate,
    snapshotDateLabel
  };
}

function consignmentFingerprint(consignments) {
  const sorted = [...consignments].map((c) => String(c).trim().toUpperCase()).filter(Boolean).sort();
  return crypto.createHash("sha256").update(sorted.join("\n")).digest("hex");
}

function toRecord(doc) {
  if (!doc) return null;
  const expiresAt =
    doc.expiresAt instanceof Date ? doc.expiresAt.getTime() : Number(doc.expiresAt) || 0;
  return {
    token: doc.token,
    jobId: doc.jobId,
    consignmentCount: doc.consignmentCount,
    consignments: Array.isArray(doc.consignments) ? doc.consignments : [],
    fingerprint: doc.fingerprint || null,
    generatedAt: doc.generatedAt,
    snapshotDate: doc.snapshotDate,
    snapshotDateLabel: doc.snapshotDateLabel,
    expiresAt,
    zipFileId: doc.zipFileId ? String(doc.zipFileId) : null,
    jobStatus: doc.jobStatus || null,
    jobPhase: doc.jobPhase || null,
    jobPercent: doc.jobPercent ?? 0,
    jobDetail: doc.jobDetail || null,
    jobError: doc.jobError || null,
    fileSize: doc.fileSize ?? null
  };
}

async function collection() {
  try {
    return await getExportSharesCollection();
  } catch (err) {
    throw new AppError(
      "DB_UNAVAILABLE",
      err && err.message
        ? `MongoDB unavailable: ${err.message}. Set MONGODB_URI and ensure MongoDB is running.`
        : "MongoDB unavailable. Set MONGODB_URI and ensure MongoDB is running.",
      503
    );
  }
}

async function pruneExpiredShares() {
  const col = await collection();
  const expired = await col.find({ expiresAt: { $lt: new Date() } }).toArray();
  for (const doc of expired) {
    try {
      await shareZipStore.deleteZipsForToken(doc.token);
    } catch {
      /* ignore */
    }
  }
  await col.deleteMany({ expiresAt: { $lt: new Date() } });
}

async function updateShareByJobId(jobId, patch) {
  const col = await collection();
  await col.updateOne({ jobId: String(jobId) }, { $set: patch });
}

/**
 * Called from fullExportJob when job state changes (share exports only).
 * @param {object} job
 */
async function syncShareJobProgress(job) {
  if (!job.shareToken) return;
  const patch = {
    jobStatus: job.status,
    jobPhase: job.phase,
    jobPercent: job.percent,
    jobDetail: job.detail,
    jobError: job.error,
    fileSize: job.fileSize ?? null,
    jobUpdatedAt: new Date()
  };
  try {
    await updateShareByJobId(job.id, patch);
  } catch {
    /* ignore */
  }
}

/**
 * Persist ZIP to GridFS when share export completes.
 * @param {object} job
 */
async function onShareJobComplete(job) {
  if (!job.shareToken || job.status !== "done" || !job.filePath) return;

  try {
    const zipFileId = await shareZipStore.saveZipForToken(job.shareToken, job.filePath);
    await updateShareByJobId(job.id, {
      zipFileId,
      jobStatus: "done",
      jobPhase: "done",
      jobPercent: 100,
      jobDetail: "Ready to download",
      jobError: null,
      fileSize: job.fileSize ?? null,
      jobUpdatedAt: new Date()
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[exportShare] failed to persist ZIP:", err && err.message ? err.message : err);
  }
}

async function insertShare(doc) {
  const col = await collection();
  await col.insertOne(doc);
}

async function getShareByToken(token) {
  const col = await collection();
  const doc = await col.findOne({ token: String(token || "") });
  return toRecord(doc);
}

async function findReusableShare(consignments) {
  const fp = consignmentFingerprint(consignments);
  const col = await collection();
  const doc = await col.findOne({
    fingerprint: fp,
    expiresAt: { $gte: new Date() },
    jobStatus: "done",
    zipFileId: { $exists: true, $ne: null }
  });
  return toRecord(doc);
}

function syntheticJobFromRecord(record) {
  const downloadReady = record.jobStatus === "done" && Boolean(record.zipFileId);
  return {
    id: record.jobId,
    status: record.jobStatus || "queued",
    phase: record.jobPhase,
    percent: record.jobPercent ?? 0,
    detail: record.jobDetail || "Processing…",
    error: record.jobError,
    consignmentCount: record.consignmentCount,
    createdAt: record.generatedAt,
    updatedAt: record.generatedAt,
    downloadReady: downloadReady && Boolean(record.zipFileId),
    fileSize: record.fileSize ?? null,
    _fromPersisted: true,
    _zipFileId: record.zipFileId,
    _shareToken: record.token
  };
}

/**
 * @param {string[]} consignments
 */
async function createShare(consignments) {
  await pruneExpiredShares();
  const list = consignments.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  const fp = consignmentFingerprint(list);

  const existing = await findReusableShare(list);
  if (existing) {
    return {
      token: existing.token,
      jobId: existing.jobId,
      consignmentCount: existing.consignmentCount,
      generatedAt: existing.generatedAt,
      snapshotDate: existing.snapshotDate,
      snapshotDateLabel: existing.snapshotDateLabel,
      expiresAt: existing.expiresAt,
      reused: true
    };
  }

  const meta = snapshotMeta();
  const ttlMs = await appSettings.getShareLinkTtlMs();
  const expiresAt = meta.generatedAt + ttlMs;
  const token = crypto.randomBytes(18).toString("base64url");
  const jobId = fullExportJob.createJob(list, { shareToken: token });

  await insertShare({
    token,
    jobId,
    consignments: list,
    fingerprint: fp,
    consignmentCount: list.length,
    generatedAt: meta.generatedAt,
    snapshotDate: meta.snapshotDate,
    snapshotDateLabel: meta.snapshotDateLabel,
    expiresAt: new Date(expiresAt),
    jobStatus: "queued",
    jobPhase: null,
    jobPercent: 0,
    jobDetail: "Queued…",
    jobError: null,
    zipFileId: null,
    fileSize: null,
    createdAt: new Date()
  });

  return {
    token,
    jobId,
    consignmentCount: list.length,
    generatedAt: meta.generatedAt,
    snapshotDate: meta.snapshotDate,
    snapshotDateLabel: meta.snapshotDateLabel,
    expiresAt,
    reused: false
  };
}

async function resolveShareJob(token) {
  await pruneExpiredShares();
  const record = await getShareByToken(token);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    const col = await collection();
    await col.deleteOne({ token: record.token });
    try {
      await shareZipStore.deleteZipsForToken(record.token);
    } catch {
      /* ignore */
    }
    return null;
  }

  let job = fullExportJob.getJob(record.jobId);
  if (!job && record.zipFileId) {
    job = syntheticJobFromRecord(record);
    return { record, job };
  }

  if (!job && record.consignments.length) {
    const newJobId = fullExportJob.createJob(record.consignments, { shareToken: record.token });
    const col = await collection();
    await col.updateOne(
      { token: record.token },
      {
        $set: {
          jobId: newJobId,
          jobStatus: "queued",
          jobPhase: null,
          jobPercent: 0,
          jobDetail: "Rebuilding export…",
          jobError: null,
          zipFileId: null
        }
      }
    );
    record.jobId = newJobId;
    job = fullExportJob.getJob(newJobId);
  }

  if (!job) return null;
  return { record, job };
}

module.exports = {
  createShare,
  resolveShareJob,
  pruneExpiredShares,
  snapshotMeta,
  syncShareJobProgress,
  onShareJobComplete,
  syntheticJobFromRecord
};

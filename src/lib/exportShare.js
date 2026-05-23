/**
 * Public full-ZIP share links — token → job mapping in MongoDB for fast resolve.
 */

const crypto = require("crypto");
const config = require("./config");
const { AppError } = require("./errors");
const { getExportSharesCollection } = require("./mongo");
const fullExportJob = require("./fullExportJob");

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

function toRecord(doc) {
  if (!doc) return null;
  const expiresAt =
    doc.expiresAt instanceof Date ? doc.expiresAt.getTime() : Number(doc.expiresAt) || 0;
  return {
    token: doc.token,
    jobId: doc.jobId,
    consignmentCount: doc.consignmentCount,
    generatedAt: doc.generatedAt,
    snapshotDate: doc.snapshotDate,
    snapshotDateLabel: doc.snapshotDateLabel,
    expiresAt
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
  await col.deleteMany({ expiresAt: { $lt: new Date() } });
}

async function insertShare({
  token,
  jobId,
  consignmentCount,
  generatedAt,
  snapshotDate,
  snapshotDateLabel,
  expiresAt
}) {
  const col = await collection();
  await col.insertOne({
    token,
    jobId,
    consignmentCount,
    generatedAt,
    snapshotDate,
    snapshotDateLabel,
    expiresAt: new Date(expiresAt)
  });
}

async function getShareByToken(token) {
  const col = await collection();
  const doc = await col.findOne({ token: String(token || "") });
  return toRecord(doc);
}

/**
 * @param {string[]} consignments
 */
async function createShare(consignments) {
  await pruneExpiredShares();
  const meta = snapshotMeta();
  const jobId = fullExportJob.createJob(consignments);
  const token = crypto.randomBytes(18).toString("base64url");
  const expiresAt = meta.generatedAt + config.exportShareTtlMs;

  await insertShare({
    token,
    jobId,
    consignmentCount: consignments.length,
    generatedAt: meta.generatedAt,
    snapshotDate: meta.snapshotDate,
    snapshotDateLabel: meta.snapshotDateLabel,
    expiresAt
  });

  return {
    token,
    jobId,
    consignmentCount: consignments.length,
    generatedAt: meta.generatedAt,
    snapshotDate: meta.snapshotDate,
    snapshotDateLabel: meta.snapshotDateLabel,
    expiresAt
  };
}

async function resolveShareJob(token) {
  await pruneExpiredShares();
  const record = await getShareByToken(token);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    const col = await collection();
    await col.deleteOne({ token: record.token });
    return null;
  }
  const job = fullExportJob.getJob(record.jobId);
  if (!job) return null;
  return { record, job };
}

module.exports = {
  createShare,
  resolveShareJob,
  pruneExpiredShares,
  snapshotMeta
};

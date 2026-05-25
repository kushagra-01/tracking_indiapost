/**
 * App-wide tunables stored in MongoDB (singleton document).
 */

const { AppError } = require("./errors");
const { durationToMs } = require("./duration");
const { getAppSettingsCollection } = require("./mongo");

const SETTINGS_ID = "singleton";

const DEFAULTS = {
  consignmentCache: { value: 24, unit: "hour" },
  shareLinkExpiry: { value: 30, unit: "day" }
};

let cached = null;
let cachedAt = 0;
const CACHE_MS = 5_000;

function normalizeDuration(input, fallback) {
  const value = Number(input?.value);
  const unit = input?.unit === "day" ? "day" : "hour";
  const n = Number.isFinite(value) && value > 0 ? Math.min(value, unit === "day" ? 365 : 24 * 365) : fallback.value;
  return { value: n, unit };
}

function toPublic(doc) {
  const base = doc || DEFAULTS;
  return {
    consignmentCache: normalizeDuration(base.consignmentCache, DEFAULTS.consignmentCache),
    shareLinkExpiry: normalizeDuration(base.shareLinkExpiry, DEFAULTS.shareLinkExpiry),
    updatedAt: base.updatedAt || null,
    updatedBy: base.updatedBy || null
  };
}

async function loadRaw() {
  const col = await getAppSettingsCollection();
  return col.findOne({ _id: SETTINGS_ID });
}

async function getSettings({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cached && now - cachedAt < CACHE_MS) {
    return cached;
  }
  try {
    const doc = await loadRaw();
    cached = toPublic(doc);
    cachedAt = now;
    return cached;
  } catch {
    cached = toPublic(null);
    cachedAt = now;
    return cached;
  }
}

async function getConsignmentCacheTtlMs() {
  const s = await getSettings();
  return durationToMs(s.consignmentCache, DEFAULTS.consignmentCache);
}

async function getShareLinkTtlMs() {
  const s = await getSettings();
  return durationToMs(s.shareLinkExpiry, DEFAULTS.shareLinkExpiry);
}

/**
 * @param {{ consignmentCache?: object, shareLinkExpiry?: object }} patch
 * @param {{ username?: string, role?: string }} actor
 */
async function updateSettings(patch, actor) {
  const col = await getAppSettingsCollection();
  const current = toPublic(await loadRaw());
  const next = {
    consignmentCache: patch.consignmentCache
      ? normalizeDuration(patch.consignmentCache, current.consignmentCache)
      : current.consignmentCache,
    shareLinkExpiry: patch.shareLinkExpiry
      ? normalizeDuration(patch.shareLinkExpiry, current.shareLinkExpiry)
      : current.shareLinkExpiry,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.username || actor?.sub || null
  };

  if (next.consignmentCache.value < 1 || next.shareLinkExpiry.value < 1) {
    throw new AppError("VALIDATION_ERROR", "Duration values must be at least 1", 400);
  }

  await col.updateOne(
    { _id: SETTINGS_ID },
    { $set: next },
    { upsert: true }
  );

  cached = toPublic(next);
  cachedAt = Date.now();
  return cached;
}

function invalidateCache() {
  cached = null;
  cachedAt = 0;
}

module.exports = {
  getSettings,
  updateSettings,
  getConsignmentCacheTtlMs,
  getShareLinkTtlMs,
  invalidateCache,
  DEFAULTS,
  durationToMs
};

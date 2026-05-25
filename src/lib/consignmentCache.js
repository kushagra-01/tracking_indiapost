/**
 * Per-consignment tracking cache in MongoDB — avoids repeat India Post calls within TTL.
 */

const appSettings = require("./appSettings");
const { getConsignmentCacheCollection } = require("./mongo");

async function getFreshItems(consignments) {
  const ttlMs = await appSettings.getConsignmentCacheTtlMs();
  const col = await getConsignmentCacheCollection();
  const since = new Date(Date.now() - ttlMs);
  const docs = await col
    .find({
      consignment: { $in: consignments },
      searchedAt: { $gte: since }
    })
    .toArray();

  const map = new Map();
  for (const doc of docs) {
    if (doc.item) map.set(doc.consignment, doc.item);
  }
  return map;
}

async function upsertItems(items) {
  if (!items.length) return;
  const col = await getConsignmentCacheCollection();
  const now = new Date();
  const ops = items
    .map((item) => {
      const c = String(item.consignment || item.booking_details?.article_number || "")
        .trim()
        .toUpperCase();
      if (!c) return null;
      return {
        updateOne: {
          filter: { consignment: c },
          update: {
            $set: { consignment: c, item, searchedAt: now }
          },
          upsert: true
        }
      };
    })
    .filter(Boolean);

  if (ops.length) await col.bulkWrite(ops, { ordered: false });
}

module.exports = { getFreshItems, upsertItems };

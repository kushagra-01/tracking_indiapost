/**
 * Bulk tracking with MongoDB cache — uses cached items when searched within configured TTL.
 */

const { bulkTrack: bulkTrackUpstream } = require("./indiaPostClient");
const consignmentCache = require("./consignmentCache");

async function bulkTrack(consignments) {
  const unique = [];
  const seen = new Set();
  for (const c of consignments) {
    const u = String(c || "").trim().toUpperCase();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }

  if (!unique.length) {
    return { upstream_message: "", count: 0, items: [], fromCache: 0, fetched: 0 };
  }

  let cachedMap;
  try {
    cachedMap = await consignmentCache.getFreshItems(unique);
  } catch {
    cachedMap = new Map();
  }

  const toFetch = unique.filter((c) => !cachedMap.has(c));
  let fetched = { upstream_message: "", count: 0, items: [] };

  if (toFetch.length) {
    fetched = await bulkTrackUpstream(toFetch);
    try {
      await consignmentCache.upsertItems(fetched.items || []);
    } catch {
      /* cache write failure must not break tracking */
    }
  }

  const items = [];
  for (const c of unique) {
    const hit = cachedMap.get(c);
    if (hit) items.push(hit);
  }
  for (const it of fetched.items || []) {
    const c = String(it.consignment || it.booking_details?.article_number || "")
      .trim()
      .toUpperCase();
    if (!cachedMap.has(c)) items.push(it);
  }

  const messages = [];
  if (fetched.upstream_message) messages.push(fetched.upstream_message);
  if (cachedMap.size) messages.push(`(${cachedMap.size} from cache)`);

  return {
    upstream_message: messages.join(" ").trim(),
    count: items.length,
    items,
    fromCache: cachedMap.size,
    fetched: toFetch.length
  };
}

module.exports = { bulkTrack };

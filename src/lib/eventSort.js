/**
 * Sort tracking events newest-first. Keep in sync with `client/.../eventSort.ts`.
 */

function eventSortKey(e) {
  if (!e) return 0;
  const raw = e.date != null ? String(e.date) : "";
  const t = e.time != null ? String(e.time) : "00:00:00";
  const d = raw ? new Date(raw).getTime() : NaN;
  const base = Number.isFinite(d) ? d : 0;
  const parts = t.split(":").map((x) => parseInt(x, 10) || 0);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return base + ((h * 3600 + m * 60 + s) | 0);
}

/** @param {object[]} events */
function sortTrackingEventsDesc(events) {
  if (!Array.isArray(events) || events.length < 2) return Array.isArray(events) ? [...events] : [];
  return [...events].sort((a, b) => eventSortKey(b) - eventSortKey(a));
}

module.exports = { sortTrackingEventsDesc, eventSortKey };

/**
 * India Post returns tracking_details oldest → newest; store last → first for UI/PDF.
 */

/** @param {object[]} events */
function orderTrackingDetailsLastToFirst(events) {
  if (!Array.isArray(events) || events.length < 2) {
    return Array.isArray(events) ? [...events] : [];
  }
  const out = [];
  for (let i = events.length - 1; i >= 0; i--) {
    out.push(events[i]);
  }
  return out;
}

module.exports = { orderTrackingDetailsLastToFirst };

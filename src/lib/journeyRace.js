/**
 * Mirrors `client/src/features/tracking/journeyRace.ts` — used for PDF layout parity with the app.
 * Journey milestones disabled; isRtoOrReturn kept for RTO detection.
 */

function trackingBlob(it) {
  const st = String(it.status || "");
  const evs = (Array.isArray(it.tracking_details) ? it.tracking_details : []).map((e) => String(e.event || ""));
  return `${st}\n${evs.join("\n")}`.toLowerCase();
}

/*
const JOURNEY_STAGES = [
  { key: "booked", label: "Booked", shortLabel: "Booked" },
  { key: "dispatched", label: "Dispatched", shortLabel: "Disp." },
  { key: "in_transit", label: "In transit", shortLabel: "Transit" },
  { key: "out_for_delivery", label: "Out for delivery", shortLabel: "OFD" },
  { key: "delivered", label: "Delivered", shortLabel: "Delivered" }
];

function furthestJourneyStage(it) {
  const t = trackingBlob(it);
  const st = String(it.status || "").toLowerCase();

  const delivered =
    /\b(item )?delivered\b|successfully delivered|handed over|delivery complete|pod\b/i.test(t) &&
    !/out for delivery|out-for-delivery/i.test(st);
  if (delivered) return 4;

  if (/out for delivery|out-for-delivery|out for del|attempt.*delivery|card.*involved/i.test(t)) return 3;

  if (
    /\b(in transit|in-transit)\b|transit|forwarded|processed at|received at|bag received|item received|misrouted|mis-route/i.test(
      t
    )
  )
    return 2;

  if (/\bdespatched\b|\bdispatched\b|bag despatched|sent to|offered? to/i.test(t)) return 1;

  if (
    /\bbooked\b|\bposted\b|booking|booking received|item booked|acceptance|office of (booking|origin)/i.test(t) ||
    Boolean(it.consignment || (it.booking_details && it.booking_details.article_number))
  )
    return 0;

  return 0;
}

function journeyStagesWithState(it) {
  const maxDone = furthestJourneyStage(it);
  return JOURNEY_STAGES.map((s, i) => ({
    ...s,
    done: i <= maxDone,
    current: i === maxDone
  }));
}
*/

function isRtoOrReturn(it) {
  const t = trackingBlob(it);
  return /\brto\b|return to origin|returned to sender|undelivered/i.test(t);
}

module.exports = {
  // JOURNEY_STAGES,
  // furthestJourneyStage,
  // journeyStagesWithState,
  isRtoOrReturn
};

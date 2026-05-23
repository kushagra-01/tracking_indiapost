import type { TrackingItem } from "./types";

// Journey milestones disabled — uncomment JOURNEY_STAGES + functions below to re-enable.
// export const JOURNEY_STAGES = [
//   { key: "booked", label: "Booked", shortLabel: "Booked", emoji: "📥" },
//   { key: "dispatched", label: "Dispatched", shortLabel: "Disp.", emoji: "🚚" },
//   { key: "in_transit", label: "In transit", shortLabel: "Transit", emoji: "🛣️" },
//   { key: "out_for_delivery", label: "Out for delivery", shortLabel: "OFD", emoji: "📬" },
//   { key: "delivered", label: "Delivered", shortLabel: "Delivered", emoji: "✅" }
// ] as const;

function trackingBlob(it: TrackingItem): string {
  const st = String(it.status || "");
  const evs = (it.tracking_details || []).map((e) => String(e.event || ""));
  return `${st}\n${evs.join("\n")}`.toLowerCase();
}

/*
export function furthestJourneyStage(it: TrackingItem): number {
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
    Boolean(it.consignment || it.booking_details?.article_number)
  )
    return 0;

  return 0;
}

export function journeyStagesWithState(it: TrackingItem) {
  const maxDone = furthestJourneyStage(it);
  return JOURNEY_STAGES.map((s, i) => ({
    ...s,
    done: i <= maxDone,
    current: i === maxDone
  }));
}
*/

export function isRtoOrReturn(it: TrackingItem): boolean {
  const t = trackingBlob(it);
  return /\brto\b|return to origin|returned to sender|undelivered/i.test(t);
}

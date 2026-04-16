/** Pick a visual emoji for a tracking event line (India Post–style wording). */
export function emojiForTrackingEvent(text: string | null | undefined): string {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return "📋";
  if (/delivered|handed over|pod|delivery complete|successfully delivered/i.test(t)) return "✅";
  if (/out for delivery|out-for-delivery|ofd|card.*involved|attempt.*delivery/i.test(t)) return "📬";
  if (/rto|return to origin|returned to sender|undelivered/i.test(t)) return "↩️";
  if (/transit|forwarded|in transit|in-transit|misroute|route/i.test(t)) return "🛣️";
  if (/despatch|dispatch|truck|vehicle|carrier|transport|bag despatched|sent to next/i.test(t)) return "🚚";
  if (/process|sorting|hub|rmo|npc|ams|speed post centre|processing center/i.test(t)) return "⚙️";
  if (/book|posted|booking|acceptance|office of booking/i.test(t)) return "📥";
  if (/received at|item received|bag received|received in/i.test(t)) return "📦";
  return "📍";
}

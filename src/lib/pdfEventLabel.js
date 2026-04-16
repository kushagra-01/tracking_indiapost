/**
 * Short ASCII tags for PDF event lines (Helvetica-safe; avoids emoji tofu in PDFKit).
 * Logic aligned with `client/src/features/tracking/eventEmoji.ts`.
 */
function pdfEventKindTag(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return "—";
  if (/delivered|handed over|pod|delivery complete|successfully delivered/i.test(t)) return "DLV";
  if (/out for delivery|out-for-delivery|ofd|card.*involved|attempt.*delivery/i.test(t)) return "OFD";
  if (/rto|return to origin|returned to sender|undelivered/i.test(t)) return "RTO";
  if (/transit|forwarded|in transit|in-transit|misroute|route/i.test(t)) return "TRN";
  if (/despatch|dispatch|truck|vehicle|carrier|transport|bag despatched|sent to next/i.test(t)) return "DSP";
  if (/process|sorting|hub|rmo|npc|ams|speed post centre|processing center/i.test(t)) return "HUB";
  if (/book|posted|booking|acceptance|office of booking/i.test(t)) return "BKG";
  if (/received at|item received|bag received|received in/i.test(t)) return "RCV";
  return "LOC";
}

module.exports = { pdfEventKindTag };

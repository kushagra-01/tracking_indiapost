/**
 * India Post tracking events may carry remarks under several field names.
 * Keep in sync with `client/src/features/tracking/eventRemarks.ts`.
 */

const REMARK_KEYS = [
  "remarks",
  "remark",
  "Remarks",
  "Remark",
  "non_del_reason",
  "nonDelReason",
  "NonDelReason",
  "non_delivery_reason",
  "comment",
  "comments",
  "note",
  "notes",
  "additional_info",
  "additionalInfo"
];

function extractEventRemarks(e) {
  if (!e || typeof e !== "object") return null;
  for (const k of REMARK_KEYS) {
    const v = e[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function formatEventRemarksForDisplay(e) {
  const r = extractEventRemarks(e);
  return r || "—";
}

module.exports = { extractEventRemarks, formatEventRemarksForDisplay };

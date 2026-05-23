/** @see `src/lib/eventRemarks.js` */

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
] as const;

export function extractEventRemarks(e: Record<string, unknown> | null | undefined): string | null {
  if (!e || typeof e !== "object") return null;
  for (const k of REMARK_KEYS) {
    const v = e[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

export function formatEventRemarksForDisplay(e: Record<string, unknown> | null | undefined): string {
  return extractEventRemarks(e) || "—";
}

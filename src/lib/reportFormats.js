/**
 * Single definition of Excel sheet names, upload column, and template file naming.
 * PDF copy/branding lives in `report.js` — do not duplicate strings in the frontend for exports.
 *
 * Client mirror: `client/src/features/tracking/reportFormats.ts` (keep in sync).
 */
module.exports = {
  SHEET_CONSIGNMENTS: "Consignments",
  SHEET_ALL_EVENTS: "All_Events",
  SHEET_EXPORT_INFO: "_Export_Info",

  /** Inbound upload files must include this column (first sheet). */
  UPLOAD_COLUMN_CONSIGNMENT: "consignment",

  EXAMPLE_CONSIGNMENT: "QM125388411IN",

  UPLOAD_TEMPLATE_FILENAME: "consignments_template.xlsx",

  PDF_BRAND_LINE:
    "India Post · Department of Posts — PDF exports use the same journey logic and fields as the tracking app (see server report.js).",
  PDF_FOOTER_NOTE:
    "India Post bulk tracking (large lists batched server-side) · PDF layout: India Post banner, journey milestones, booking & routing, full event trail."
};

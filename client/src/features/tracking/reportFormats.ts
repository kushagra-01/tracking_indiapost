/**
 * Must match `src/lib/reportFormats.js` (sheet names, upload column).
 * Use these when parsing uploads — never hardcode column strings in pages.
 */
export const SHEET_CONSIGNMENTS = "Consignments" as const;
export const SHEET_ALL_EVENTS = "All_Events" as const;
export const SHEET_EXPORT_INFO = "_Export_Info" as const;

export const UPLOAD_COLUMN_CONSIGNMENT = "consignment" as const;

export const EXAMPLE_CONSIGNMENT = "QM125388411IN" as const;

export const UPLOAD_TEMPLATE_FILENAME = "consignments_template.xlsx" as const;

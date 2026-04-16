/**
 * Used for ZIP PDF subfolders — must match server `src/lib/consignmentCategory.js`.
 */
export type ConsignmentCategory = "Delivered" | "RTO_Return" | "In_Transit" | "Unknown";

export function getConsignmentCategory(status: string | null | undefined): ConsignmentCategory {
  const st = String(status || "").toLowerCase();
  if (!st) return "Unknown";
  if (st.includes("delivered")) return "Delivered";
  if (st.includes("rto") || st.includes("return")) return "RTO_Return";
  return "In_Transit";
}

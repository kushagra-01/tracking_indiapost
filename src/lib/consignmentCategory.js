/**
 * Used for Excel "Category" column and ZIP PDF subfolders.
 * Keep in sync with `client/src/features/tracking/consignmentCategory.ts`.
 */
function getConsignmentCategory(status) {
  const st = String(status || "").toLowerCase();
  if (!st) return "Unknown";
  if (st.includes("delivered")) return "Delivered";
  if (st.includes("rto") || st.includes("return")) return "RTO_Return";
  return "In_Transit";
}

module.exports = { getConsignmentCategory };

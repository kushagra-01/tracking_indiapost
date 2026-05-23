/**
 * Category helpers — keep in sync with `client/src/features/tracking/consignmentCategory.ts`.
 * ZIP PDF subfolders use `getShipmentDisplayLabelFromItem` → Delivered, Delivered-RTO, Transit, Transit-RTO.
 */
const { isRtoOrReturn } = require("./journeyRace");

/** @typedef {"Delivered" | "Delivered-RTO" | "Transit" | "Transit-RTO"} ShipmentDisplayLabel */

/** @type {ShipmentDisplayLabel[]} */
const SHIPMENT_FOLDER_LABELS = ["Delivered", "Delivered-RTO", "Transit", "Transit-RTO"];

function getConsignmentCategory(status) {
  const st = String(status || "")
    .toLowerCase()
    .trim();

  if (!st) return "Unknown";

  if (
    st.includes("not delivered") ||
    st.includes("in transit") ||
    st.includes("transit")
  ) {
    return "In_Transit";
  }

  if (st.includes("delivered")) return "Delivered";

  if (st.includes("rto") || st.includes("return") || st.includes("returned")) {
    return "RTO_Return";
  }

  return "In_Transit";
}

/** @param {string | null | undefined} status @param {boolean} rto */
function getShipmentDisplayLabel(status, rto) {
  const delivered = getConsignmentCategory(status) === "Delivered";
  if (delivered && rto) return "Delivered-RTO";
  if (delivered) return "Delivered";
  if (rto) return "Transit-RTO";
  return "Transit";
}

/** @param {object} it tracking item */
function getShipmentDisplayLabelFromItem(it) {
  return getShipmentDisplayLabel(it && it.status, isRtoOrReturn(it));
}

function emptyFolderCounts() {
  return {
    Delivered: 0,
    "Delivered-RTO": 0,
    Transit: 0,
    "Transit-RTO": 0
  };
}

module.exports = {
  SHIPMENT_FOLDER_LABELS,
  getConsignmentCategory,
  getShipmentDisplayLabel,
  getShipmentDisplayLabelFromItem,
  emptyFolderCounts
};

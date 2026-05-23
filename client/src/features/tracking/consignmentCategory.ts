import { isRtoOrReturn } from "./journeyRace";
import type { TrackingItem } from "./types";

/**
 * Legacy status bucket — must match server `getConsignmentCategory`.
 * ZIP / Excel export folders use `ShipmentDisplayLabel` instead.
 */
export type ConsignmentCategory =
  | "Delivered"
  | "RTO_Return"
  | "In_Transit"
  | "Unknown";

export function getConsignmentCategory(
  status: string | null | undefined
): ConsignmentCategory {
  const st = String(status || "").toLowerCase().trim();

  if (!st) return "Unknown";

    // Explicit not delivered -> In Transit
    if (
      st.includes("not delivered") ||
      st.includes("in transit") ||
      st.includes("transit")
    ) {
      return "In_Transit";
    }

  // Delivered
  if (st.includes("delivered")) {
    return "Delivered";
  }

  // RTO / Return cases
  if (
    st.includes("rto") ||
    st.includes("return") ||
    st.includes("returned")
  ) {
    return "RTO_Return";
  }



  // Default fallback
  return "In_Transit";
}

/** Dashboard chip + ZIP folder names — must match server `SHIPMENT_FOLDER_LABELS`. */
export type ShipmentDisplayLabel = "Delivered" | "Delivered-RTO" | "Transit" | "Transit-RTO";

export const SHIPMENT_FOLDER_LABELS: ShipmentDisplayLabel[] = [
  "Delivered",
  "Delivered-RTO",
  "Transit",
  "Transit-RTO"
];

export function emptyFolderCounts(): Record<ShipmentDisplayLabel, number> {
  return { Delivered: 0, "Delivered-RTO": 0, Transit: 0, "Transit-RTO": 0 };
}

export function getShipmentDisplayLabel(
  status: string | null | undefined,
  rto: boolean
): ShipmentDisplayLabel {
  const delivered = getConsignmentCategory(status) === "Delivered";
  if (delivered && rto) return "Delivered-RTO";
  if (delivered) return "Delivered";
  if (rto) return "Transit-RTO";
  return "Transit";
}

export function getShipmentDisplayLabelFromItem(it: TrackingItem): ShipmentDisplayLabel {
  return getShipmentDisplayLabel(it.status, isRtoOrReturn(it));
}

export function displayLabelChipColor(
  label: ShipmentDisplayLabel
): "success" | "warning" | "info" | "default" {
  if (label === "Delivered") return "success";
  if (label === "Delivered-RTO" || label === "Transit-RTO") return "warning";
  if (label === "Transit") return "info";
  return "default";
}
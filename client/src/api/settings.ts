import { http } from "./http";

export type DurationUnit = "hour" | "day";

export type DurationSetting = {
  value: number;
  unit: DurationUnit;
};

export type AppSettings = {
  consignmentCache: DurationSetting;
  shareLinkExpiry: DurationSetting;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function fetchSettings(): Promise<AppSettings> {
  const resp = await http.get("/settings");
  return resp.data.data as AppSettings;
}

export async function updateSettings(patch: {
  consignmentCache?: DurationSetting;
  shareLinkExpiry?: DurationSetting;
}): Promise<AppSettings> {
  const resp = await http.patch("/settings", patch);
  return resp.data.data as AppSettings;
}

export function formatDuration(d: DurationSetting): string {
  const u = d.unit === "day" ? (d.value === 1 ? "day" : "days") : d.value === 1 ? "hour" : "hours";
  return `${d.value} ${u}`;
}

export function formatExpiryDate(expiresAtMs: number): string {
  return new Date(expiresAtMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

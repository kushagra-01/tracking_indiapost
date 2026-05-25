import axios from "axios";

import { apiBaseUrl, http } from "../../api/http";
import type { FullExportJobStatus } from "./api";

/** No Authorization header — public share endpoints only */
const publicHttp = axios.create({
  baseURL: apiBaseUrl,
  timeout: 900_000
});

export type ShareExportMeta = {
  token: string;
  jobId: string;
  consignmentCount: number;
  generatedAt: number;
  snapshotDate: string;
  snapshotDateLabel: string;
  expiresAt?: number;
  reused?: boolean;
};

export type ShareExportStatus = {
  consignmentCount: number;
  generatedAt: number;
  snapshotDate: string;
  snapshotDateLabel: string;
  expiresAt?: number;
  job: FullExportJobStatus;
};

export async function createFullExportShareLink(consignments: string[]): Promise<ShareExportMeta> {
  const resp = await http.post("/share/full-export", { consignments }, { timeout: 60_000 });
  return resp.data.data as ShareExportMeta;
}

export function buildSharePageUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${encodeURIComponent(token)}`;
}

export async function fetchShareExportStatus(token: string): Promise<ShareExportStatus> {
  const resp = await publicHttp.get(`/share/full-export/${encodeURIComponent(token)}`);
  return resp.data.data as ShareExportStatus;
}

export async function downloadShareExportZip(
  token: string,
  onProgress?: (pct: number | null, loaded: number, total: number | undefined) => void
): Promise<Blob> {
  const resp = await publicHttp.get(`/share/full-export/${encodeURIComponent(token)}/download`, {
    responseType: "blob",
    onDownloadProgress: (ev) => {
      const total = ev.total;
      const loaded = ev.loaded;
      const pct = total && total > 0 ? Math.min(100, Math.round((loaded * 100) / total)) : null;
      onProgress?.(pct, loaded, total);
    }
  });
  return resp.data as Blob;
}

export function shareZipFilename(generatedAt: number): string {
  const stamp = new Date(generatedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `IndiaPost_Full_Report_${stamp}.zip`;
}

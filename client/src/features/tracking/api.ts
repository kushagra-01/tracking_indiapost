import { http } from "../../api/http";
import type { TrackResponse } from "./types";
import { UPLOAD_TEMPLATE_FILENAME } from "./reportFormats";

/** Must exceed worst-case server time for large batches (see server `SERVER_REQUEST_TIMEOUT_MS`). */
const TRACK_REQUEST_TIMEOUT_MS = 900_000;

export async function trackConsignments(consignments: string[]): Promise<TrackResponse> {
  const resp = await http.post("/track", { consignments }, { timeout: TRACK_REQUEST_TIMEOUT_MS });
  return resp.data.data as TrackResponse;
}

/** Upload template — same bytes as server `buildUploadTemplateBuffer` (single format app-wide). */
export async function fetchUploadTemplate(): Promise<Blob> {
  const resp = await http.get("/track/upload-template", { responseType: "blob" });
  return resp.data as Blob;
}

export function uploadTemplateDownloadFilename() {
  return UPLOAD_TEMPLATE_FILENAME;
}

/**
 * Server-side reports (uniform everywhere):
 * - `xlsx` → master workbook: sheets Consignments, All_Events, _Export_Info (same as ZIP export).
 * - `csv` → Consignments table only (same columns as Excel summary).
 * - `pdf` → single-article detail or multi summary per server rules.
 */
export async function downloadReport(consignments: string[], format: "pdf" | "xlsx" | "csv") {
  const resp = await http.post(
    "/track/report",
    { consignments, format },
    {
      responseType: "arraybuffer",
      timeout: TRACK_REQUEST_TIMEOUT_MS
    }
  );

  const contentType = resp.headers["content-type"] || "application/octet-stream";
  const disposition = resp.headers["content-disposition"] || "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] || `tracking_report.${format}`;

  return { buf: resp.data as ArrayBuffer, contentType, filename };
}

/** Server-queued full ZIP (master XLSX + PDFs per article) — poll + download when ready. */
export type FullExportJobStatus = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  phase: string | null;
  percent: number;
  detail: string;
  error: string | null;
  consignmentCount: number;
  createdAt: number;
  updatedAt: number;
  downloadReady: boolean;
  fileSize: number | null;
};

export async function createFullExportJob(consignments: string[]): Promise<{ jobId: string }> {
  const resp = await http.post("/track/export-full-report", { consignments }, { timeout: 60_000 });
  return resp.data.data as { jobId: string };
}

export async function listFullExportJobs(): Promise<{ items: FullExportJobStatus[] }> {
  const resp = await http.get("/track/export-full-report");
  return resp.data.data as { items: FullExportJobStatus[] };
}

export async function cancelFullExportJob(id: string): Promise<void> {
  await http.post(`/track/export-full-report/${encodeURIComponent(id)}/cancel`);
}

export async function downloadFullExportJob(id: string): Promise<Blob> {
  const resp = await http.get(`/track/export-full-report/${encodeURIComponent(id)}/download`, {
    responseType: "blob",
    timeout: TRACK_REQUEST_TIMEOUT_MS
  });
  return resp.data as Blob;
}

import { http } from "../../api/http";
import type { TrackResponse } from "./types";
import { UPLOAD_TEMPLATE_FILENAME } from "./reportFormats";

/** Must exceed worst-case server time for large batches (see server `SERVER_REQUEST_TIMEOUT_MS`). */
const TRACK_REQUEST_TIMEOUT_MS = 900_000;

/** Matches server `BULK_MAX_PER_REQUEST` in `indiaPostClient.js`. */
const BULK_MAX_PER_REQUEST = 50;

export async function trackConsignments(consignments: string[]): Promise<TrackResponse> {
  const resp = await http.post("/track", { consignments }, { timeout: TRACK_REQUEST_TIMEOUT_MS });
  return resp.data.data as TrackResponse;
}

/**
 * Tracks in chunks so progress can update after each successful upstream batch.
 * `onProgress` is called with `showPercent: true` only after the first chunk succeeds.
 */
export async function trackConsignmentsWithProgress(
  consignments: string[],
  onProgress: (percent: number, showPercent: boolean, detail: string) => void
): Promise<TrackResponse> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of consignments) {
    const c = raw.trim().toUpperCase();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    unique.push(c);
  }
  if (!unique.length) {
    return { upstream_message: "", count: 0, items: [] };
  }

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BULK_MAX_PER_REQUEST) {
    chunks.push(unique.slice(i, i + BULK_MAX_PER_REQUEST));
  }

  const mergedItems: TrackResponse["items"] = [];
  const messages: string[] = [];
  let showPercent = false;

  for (let i = 0; i < chunks.length; i++) {
    const part = await trackConsignments(chunks[i]);
    if (!showPercent) {
      showPercent = true;
      onProgress(0, true, `Received batch 1 of ${chunks.length}…`);
    }
    mergedItems.push(...part.items);
    if (part.upstream_message) messages.push(part.upstream_message);
    const pct = Math.round(((i + 1) / chunks.length) * 100);
    onProgress(
      pct,
      true,
      chunks.length > 1 ? `Batch ${i + 1} of ${chunks.length} complete` : "Processing results…"
    );
  }

  return {
    upstream_message: messages.join(" ").trim(),
    count: mergedItems.length,
    items: mergedItems
  };
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

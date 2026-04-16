import JSZip from "jszip";

import { downloadReport } from "./api";
import type { TrackingItem } from "./types";
import { getConsignmentCategory, type ConsignmentCategory } from "./consignmentCategory";

export type { ConsignmentCategory };

function buildReadme(stats: { total: number; pdfCount: number; byCat: Record<ConsignmentCategory, number> }) {
  const lines = [
    "India Post — Full tracking export",
    "================================",
    "",
    `Generated (UTC): ${new Date().toISOString()}`,
    "",
    "Contents",
    "--------",
    "Excel/Master_Consignments.xlsx",
    "  • Same master workbook as Dashboard → XLSX (server-generated).",
    "  • Sheets: Consignments, All_Events, _Export_Info",
    "",
    "PDF/<Category>/<ARTICLE>.pdf",
    "  • Delivered, RTO_Return, In_Transit, Unknown — same PDF layout as single-article download",
    "",
    "Counts",
    "------",
    `Articles in Excel: ${stats.total}`,
    `PDF files generated: ${stats.pdfCount}`,
    `  Delivered: ${stats.byCat.Delivered}`,
    `  RTO_Return: ${stats.byCat.RTO_Return}`,
    `  In_Transit: ${stats.byCat.In_Transit}`,
    `  Unknown: ${stats.byCat.Unknown}`,
    "",
    "Note: Excel and PDFs are produced by the same server export pipeline for consistency.",
    ""
  ];
  return lines.join("\r\n");
}

export type FullReportProgress = {
  phase: "excel" | "pdf" | "zip" | "done" | "error";
  percent: number;
  detail: string;
};

export async function buildFullReportZip(
  items: TrackingItem[],
  opts: {
    onProgress: (p: FullReportProgress) => void;
    signal?: AbortSignal;
  }
): Promise<Blob> {
  const { onProgress, signal } = opts;

  const check = () => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  };

  const seen = new Set<string>();
  const list = items.filter((it) => {
    const c = String(it.consignment || it.booking_details?.article_number || "")
      .trim()
      .toUpperCase();
    if (!c || seen.has(c)) return false;
    seen.add(c);
    return true;
  });
  const ids = list.map((it) => String(it.consignment || it.booking_details?.article_number).trim().toUpperCase());

  check();
  onProgress({ phase: "excel", percent: 2, detail: "Downloading master Excel (server export)…" });

  const zip = new JSZip();

  if (ids.length) {
    const { buf } = await downloadReport(ids, "xlsx");
    check();
    zip.folder("Excel")!.file("Master_Consignments.xlsx", buf);
  } else {
    zip.folder("Excel")!.file("README.txt", "No consignments to export.\r\n");
  }

  const pdfRoot = zip.folder("PDF")!;
  const catFolders: Record<ConsignmentCategory, JSZip> = {
    Delivered: pdfRoot.folder("Delivered")!,
    RTO_Return: pdfRoot.folder("RTO_Return")!,
    In_Transit: pdfRoot.folder("In_Transit")!,
    Unknown: pdfRoot.folder("Unknown")!
  };

  const total = list.length;
  const byCat: Record<ConsignmentCategory, number> = {
    Delivered: 0,
    RTO_Return: 0,
    In_Transit: 0,
    Unknown: 0
  };

  onProgress({ phase: "pdf", percent: 5, detail: total ? `Generating PDFs (0/${total})…` : "No consignments to PDF — skipping" });

  for (let i = 0; i < list.length; i++) {
    check();
    const it = list[i];
    const c = String(it.consignment || it.booking_details?.article_number || "")
      .trim()
      .toUpperCase();
    const cat = getConsignmentCategory(it.status);
    byCat[cat] += 1;

    const { buf } = await downloadReport([c], "pdf");
    catFolders[cat].file(`${c}.pdf`, buf);

    const pct = 5 + Math.round((85 * (i + 1)) / Math.max(total, 1));
    onProgress({
      phase: "pdf",
      percent: Math.min(pct, 90),
      detail: `Generating PDFs (${i + 1}/${total}) — ${c} → PDF/${cat}/`
    });

    await new Promise((r) => requestAnimationFrame(r));
  }

  check();
  onProgress({ phase: "zip", percent: 91, detail: "Creating README and compressing ZIP…" });

  zip.file(
    "README.txt",
    buildReadme({
      total: items.length,
      pdfCount: total,
      byCat
    })
  );

  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      if (metadata.percent != null) {
        onProgress({
          phase: "zip",
          percent: 91 + Math.round((metadata.percent / 100) * 9),
          detail: `Compressing archive… ${Math.round(metadata.percent)}%`
        });
      }
    }
  );

  onProgress({ phase: "done", percent: 100, detail: "Ready to download" });
  return blob;
}

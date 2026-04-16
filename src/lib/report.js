const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const { getConsignmentCategory } = require("./consignmentCategory");
const {
  SHEET_CONSIGNMENTS,
  SHEET_ALL_EVENTS,
  SHEET_EXPORT_INFO,
  PDF_FOOTER_NOTE,
  UPLOAD_COLUMN_CONSIGNMENT,
  EXAMPLE_CONSIGNMENT
} = require("./reportFormats");
const { journeyStagesWithState, isRtoOrReturn } = require("./journeyRace");

const PDF_COLORS = {
  navy: "#1e3a8a",
  navyBar: "#1e40af",
  gold: "#f59e0b",
  text: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  greenBg: "#dcfce7",
  greenBorder: "#16a34a",
  blueRing: "#2563eb"
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timestampForFilename(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function safeString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function formatDateIsoSafe(d) {
  if (d === null || d === undefined || d === "") return "";
  try {
    const x = new Date(String(d));
    if (Number.isNaN(x.getTime())) return String(d);
    if (x.getFullYear() < 1900) return "";
    return x.toISOString();
  } catch {
    return String(d);
  }
}

function formatDateDisplay(d) {
  if (!formatDateIsoSafe(d)) return "";
  try {
    return new Date(String(d)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(d);
  }
}

function formatIsoDatePdf(d) {
  try {
    if (!d) return "—";
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return safeString(d);
    return x.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return safeString(d);
  }
}

function csvEscape(value) {
  const s = safeString(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getItems(normalizedTracking) {
  return normalizedTracking && Array.isArray(normalizedTracking.items) ? normalizedTracking.items : [];
}

/** One row per article — used for Consignments sheet and CSV (same columns). */
function buildSummaryRowsFromItems(items) {
  return items.map((it, idx) => {
    const bd = it.booking_details || {};
    const cat = getConsignmentCategory(it.status);
    const le = it.last_event || {};
    const cons = safeString(it.consignment || bd.article_number);
    return {
      Row: idx + 1,
      Category: cat,
      Consignment: cons,
      Status: safeString(it.status),
      Article_Type: safeString(bd.article_type),
      Booked_At: safeString(bd.booked_at),
      Booked_On_ISO: formatDateIsoSafe(bd.booked_on),
      Booked_On_Display: formatDateDisplay(bd.booked_on),
      Origin_PIN: safeString(bd.origin_pincode),
      Dest_PIN: safeString(bd.destination_pincode),
      Delivery_Location: safeString(bd.delivery_location),
      Tariff: bd.tariff != null && bd.tariff !== "" ? bd.tariff : "",
      Delivery_Confirmed_ISO: formatDateIsoSafe(bd.delivery_confirmed_on),
      Delivery_Confirmed_Display: formatDateDisplay(bd.delivery_confirmed_on),
      Last_Event: safeString(le.event),
      Last_Event_ISO: formatDateIsoSafe(le.date),
      Last_Event_Time: safeString(le.time),
      Last_Office: safeString(le.office),
      Tracking_Event_Count: Array.isArray(it.tracking_details) ? it.tracking_details.length : 0
    };
  });
}

/** One row per tracking event. */
function buildEventRowsFromItems(items) {
  const eventRows = [];
  for (const it of items) {
    const cat = getConsignmentCategory(it.status);
    const cons = safeString(it.consignment || (it.booking_details && it.booking_details.article_number));
    const evs = Array.isArray(it.tracking_details) ? it.tracking_details : [];
    evs.forEach((e, i) => {
      eventRows.push({
        Consignment: cons,
        Category: cat,
        Status: safeString(it.status),
        Line: i + 1,
        Event_Date_ISO: formatDateIsoSafe(e.date),
        Event_Time: safeString(e.time),
        Office_ID: e.officeid != null ? e.officeid : "",
        Office: safeString(e.office),
        Event: safeString(e.event)
      });
    });
  }
  return eventRows;
}

function buildMetaRows(normalizedTracking) {
  return [
    { Key: "Generated_UTC", Value: new Date().toISOString() },
    { Key: "Upstream_Message", Value: safeString(normalizedTracking && normalizedTracking.upstream_message) },
    { Key: "Item_Count", Value: getItems(normalizedTracking).length },
    {
      Key: "Consignments_Sheet",
      Value: "One row per article (same columns as CSV). Inbound upload template: GET /track/upload-template"
    },
    { Key: "All_Events_Sheet", Value: "One row per scan/event (full timeline)" }
  ];
}

/**
 * Master workbook — same structure for dashboard XLSX, ZIP Excel, and any server-side export.
 */
function buildMasterXlsxBuffer(normalizedTracking) {
  const items = getItems(normalizedTracking);
  const summaryRows = buildSummaryRowsFromItems(items);
  const eventRows = buildEventRowsFromItems(items);
  const metaRows = buildMetaRows(normalizedTracking);

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Info: "No rows" }]);
  ws1["!cols"] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
    { wch: 22 },
    { wch: 8 },
    { wch: 28 },
    { wch: 24 },
    { wch: 36 },
    { wch: 28 },
    { wch: 12 },
    { wch: 28 },
    { wch: 36 },
    { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_CONSIGNMENTS);

  const ws2 = XLSX.utils.json_to_sheet(eventRows.length ? eventRows : [{ Info: "No events" }]);
  ws2["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 6 },
    { wch: 28 },
    { wch: 12 },
    { wch: 10 },
    { wch: 36 },
    { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, SHEET_ALL_EVENTS);

  const ws3 = XLSX.utils.json_to_sheet(metaRows);
  ws3["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws3, SHEET_EXPORT_INFO);

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

/**
 * Minimal upload template — same sheet name and primary column as master workbook `Consignments`.
 * Only this function should produce `.xlsx` templates for the app.
 */
function buildUploadTemplateBuffer() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[UPLOAD_COLUMN_CONSIGNMENT], [EXAMPLE_CONSIGNMENT]]);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_CONSIGNMENTS);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

/** CSV = Consignments sheet only (same data as Excel summary). */
function buildCsv(normalizedTracking) {
  const items = getItems(normalizedTracking);
  const rows = buildSummaryRowsFromItems(items);
  if (!rows.length) {
    return Buffer.from("Info\r\nNo rows\r\n", "utf8");
  }
  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return Buffer.from(lines.join("\r\n"), "utf8");
}

function sanitizeFilenamePart(s) {
  const u = safeString(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return u.slice(0, 40) || "report";
}

/**
 * @param {"pdf"|"xlsx"|"csv"} format
 * @param {{ consignment?: string }=} opts — when one article, use in filename
 */
function createDownloadMeta(format, opts = {}) {
  const stamp = timestampForFilename();
  const slug = opts.consignment ? sanitizeFilenamePart(opts.consignment) : null;
  const base = slug ? `tracking-${slug}` : "tracking-report";

  if (format === "pdf") {
    return {
      contentType: "application/pdf",
      filename: `${base}-${stamp}.pdf`
    };
  }
  if (format === "xlsx") {
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${base}-${stamp}.xlsx`
    };
  }
  return {
    contentType: "text/csv; charset=utf-8",
    filename: `${base}-${stamp}.csv`
  };
}

function pageInnerWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensurePageSpace(doc, minY = 720) {
  if (doc.y > minY) doc.addPage();
}

function pdfDrawIndiaPostBanner(doc, { subtitle }) {
  const m = doc.page.margins;
  const x = m.left;
  const w = pageInnerWidth(doc);
  const y = doc.y;
  const h = 56;
  doc.save();
  doc.rect(x, y, 5, h).fill(PDF_COLORS.gold);
  doc.rect(x + 5, y, w - 5, h).fill(PDF_COLORS.navyBar);
  const cx = x + 22;
  const cy = y + h / 2;
  doc.circle(cx, cy, 13).fill("#ffffff");
  doc.fillColor(PDF_COLORS.navy).fontSize(10).font("Helvetica-Bold").text("IP", cx - 8, cy - 5, { width: 16, align: "center" });
  doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text("India Post", x + 42, y + 11, { width: w - 50 });
  doc.fontSize(7.2).font("Helvetica").fillColor("#cbd5e1").text(
    "Department of Posts · Ministry of Communications · Government of India",
    x + 42,
    y + 28,
    { width: w - 50 }
  );
  if (subtitle) {
    doc.fontSize(8).fillColor("#e2e8f0").text(subtitle, x + 42, y + 40, { width: w - 50 });
  }
  doc.restore();
  doc.y = y + h + 10;
  doc.fillColor(PDF_COLORS.text);
  doc.font("Helvetica");
}

function pdfDrawGeneratedStamp(doc) {
  doc.fontSize(7.5).fillColor(PDF_COLORS.muted).text(`Generated (UTC): ${new Date().toISOString()}`, { align: "right" });
  doc.moveDown(0.5);
  doc.fillColor(PDF_COLORS.text);
}

function pdfDrawContinuationLine(doc) {
  const m = doc.page.margins;
  doc.fontSize(8).fillColor(PDF_COLORS.muted).text("India Post · Tracking report (continued)", m.left, doc.y);
  doc.moveDown(0.45);
  doc.strokeColor(PDF_COLORS.line).moveTo(m.left, doc.y).lineTo(doc.page.width - m.right, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fillColor(PDF_COLORS.text);
}

function pdfDrawJourneyStrip(doc, item, x0, y0, totalW) {
  const stages = journeyStagesWithState(item);
  const n = stages.length;
  const gap = 3;
  const boxW = (totalW - gap * (n - 1)) / n;
  let x = x0;
  const h = 20;
  for (let i = 0; i < n; i++) {
    const s = stages[i];
    doc.save();
    doc.roundedRect(x, y0, boxW, h, 2).fill(s.done ? PDF_COLORS.greenBg : "#f1f5f9");
    doc.roundedRect(x, y0, boxW, h, 2);
    doc.strokeColor(s.current ? PDF_COLORS.blueRing : s.done ? PDF_COLORS.greenBorder : "#cbd5e1");
    doc.lineWidth(s.current ? 1.1 : 0.55);
    doc.stroke();
    doc.fillColor(s.done ? "#14532d" : PDF_COLORS.muted).fontSize(6).font("Helvetica-Bold");
    doc.text(s.shortLabel, x + 2, y0 + 6, { width: boxW - 4, align: "center" });
    doc.restore();
    x += boxW + gap;
  }
  return y0 + h + 8;
}

function pdfSectionTitle(doc, title) {
  doc.moveDown(0.35);
  ensurePageSpace(doc, 700);
  doc.fontSize(10.5).font("Helvetica-Bold").fillColor(PDF_COLORS.navy).text(title);
  doc.moveDown(0.15);
  const m = doc.page.margins;
  doc.strokeColor(PDF_COLORS.line).moveTo(m.left, doc.y).lineTo(doc.page.width - m.right, doc.y).stroke();
  doc.moveDown(0.4);
  doc.fillColor(PDF_COLORS.text).font("Helvetica");
}

function pdfBookingFieldRows(bd, consignment) {
  const mo = safeString(bd.mo_number);
  const art = safeString(bd.article_number) || consignment;
  const consMo = mo || consignment || art;
  return [
    ["Consignment / MO number", consMo || "—"],
    ["Article number", art || "—"],
    ["Article type", safeString(bd.article_type) || "—"],
    ["Tariff", bd.tariff != null && bd.tariff !== "" ? `INR ${safeString(bd.tariff)}` : "—"],
    ["Booked at (office / location)", safeString(bd.booked_at) || "—"],
    ["Booked on", formatIsoDatePdf(bd.booked_on)],
    ["Origin pincode", safeString(bd.origin_pincode) || "—"],
    ["Destination pincode", safeString(bd.destination_pincode) || "—"],
    ["Destination (delivery office / area)", safeString(bd.delivery_location) || "—"],
    ["Delivered on", safeString(bd.delivery_confirmed_on) ? formatIsoDatePdf(bd.delivery_confirmed_on) : "—"]
  ];
}

/** Label column + value column — Department of Posts–style alignment. */
function pdfAlignedFieldGrid(doc, rows) {
  const m = doc.page.margins;
  const labelW = 172;
  const gap = 8;
  const xVal = m.left + labelW + gap;
  const valW = pageInnerWidth(doc) - labelW - gap;
  for (const [label, val] of rows) {
    ensurePageSpace(doc, 735);
    const y0 = doc.y;
    const v = val == null || val === "" ? "—" : String(val);
    doc.fontSize(8).fillColor(PDF_COLORS.muted).font("Helvetica-Bold");
    const hL = doc.heightOfString(label, { width: labelW, align: "left" });
    doc.text(label, m.left, y0, { width: labelW });
    doc.font("Helvetica").fillColor(PDF_COLORS.text).fontSize(9);
    const hV = doc.heightOfString(v, { width: valW, align: "left" });
    doc.text(v, xVal, y0, { width: valW });
    doc.y = y0 + Math.max(hL, hV, 11) + 4;
  }
}

function pdfEventColumnWidths(innerW) {
  const num = 16;
  const rest = innerW - num - 8;
  const d = Math.min(76, rest * 0.17);
  const t = Math.min(42, rest * 0.1);
  const o = Math.min(132, rest * 0.3);
  const r = Math.max(100, rest - d - t - o);
  return [num, d, t, o, r];
}

function pdfDrawEventTableHeader(doc) {
  const m = doc.page.margins;
  const innerW = pageInnerWidth(doc);
  const [wN, wD, wT, wO, wR] = pdfEventColumnWidths(innerW);
  const y = doc.y;
  const h = 15;
  doc.save();
  doc.rect(m.left, y, innerW, h).fill("#e8eef7");
  doc.fillColor(PDF_COLORS.navy).fontSize(7).font("Helvetica-Bold");
  let x = m.left + 2;
  doc.text("#", x, y + 4, { width: wN });
  x += wN;
  doc.text("Event date", x, y + 4, { width: wD });
  x += wD;
  doc.text("Time", x, y + 4, { width: wT });
  x += wT;
  doc.text("Office", x, y + 4, { width: wO });
  x += wO;
  doc.text("Remarks", x, y + 4, { width: wR });
  doc.restore();
  doc.y = y + h + 1;
  doc.fillColor(PDF_COLORS.text).font("Helvetica");
}

function pdfDrawEventTableRow(doc, ev, idx) {
  const m = doc.page.margins;
  const innerW = pageInnerWidth(doc);
  const [wN, wD, wT, wO, wR] = pdfEventColumnWidths(innerW);
  const y0 = doc.y;
  const dateStr = ev.date ? formatIsoDatePdf(ev.date) : "—";
  const timeStr = safeString(ev.time) || "—";
  const officeStr = safeString(ev.office) || "—";
  const remarkStr = safeString(ev.event) || "—";
  doc.font("Helvetica").fontSize(7.5).fillColor(PDF_COLORS.text);
  const hRem = doc.heightOfString(remarkStr, { width: wR });
  const hOff = doc.heightOfString(officeStr, { width: wO });
  const rowH = Math.max(13, hRem + 2, hOff + 2);
  let x = m.left + 2;
  doc.text(String(idx + 1), x, y0 + 1, { width: wN });
  x += wN;
  doc.text(dateStr, x, y0 + 1, { width: wD });
  x += wD;
  doc.text(timeStr, x, y0 + 1, { width: wT });
  x += wT;
  doc.text(officeStr, x, y0 + 1, { width: wO });
  x += wO;
  doc.text(remarkStr, x, y0 + 1, { width: wR });
  doc.y = y0 + rowH + 1;
  doc.save();
  doc.strokeColor("#f1f5f9").moveTo(m.left, doc.y - 0.5).lineTo(m.left + innerW, doc.y - 0.5).stroke();
  doc.restore();
}

function pdfRenderFooter(doc) {
  doc.moveDown(0.5);
  ensurePageSpace(doc, 760);
  doc.fontSize(7.5).fillColor("#94a3b8").text(PDF_FOOTER_NOTE, { align: "left" });
  doc.fillColor(PDF_COLORS.text);
}

/**
 * Single-article PDF — matches app “lifecycle report”: banner, journey, booking grid, full events.
 */
function buildPdfSingleItem(item) {
  const doc = new PDFDocument({ size: "A4", margin: 44 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  const bd = item.booking_details || {};
  const consignment = safeString(item.consignment || bd.article_number);
  const status = safeString(item.status);
  const m = doc.page.margins;

  pdfDrawIndiaPostBanner(doc, {
    subtitle:
      "Consignment / MO tracking report · Department of Posts, Ministry of Communications, Government of India"
  });
  pdfDrawGeneratedStamp(doc);

  doc.fontSize(9).fillColor(PDF_COLORS.muted).font("Helvetica").text(
    "Structured snapshot as accessed via India Post tracking: identifiers, booking & delivery, chronological event log.",
    { align: "left" }
  );
  doc.moveDown(0.45);
  doc.fillColor(PDF_COLORS.text);

  doc.fontSize(12).font("Helvetica-Bold").fillColor(PDF_COLORS.navy).text(`Article / consignment: ${consignment || "—"}`);
  doc.font("Helvetica").fontSize(10.5).fillColor(PDF_COLORS.text).text(`Current delivery status: ${status || "—"}`);
  if (isRtoOrReturn(item)) {
    doc.fontSize(9).fillColor("#b45309").text("Note: Return / RTO may appear in status or remarks.");
    doc.fillColor(PDF_COLORS.text);
  }
  doc.moveDown(0.45);

  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(PDF_COLORS.navy).text("Journey milestones (Booked → Dispatched → In transit → OFD → Delivered)");
  doc.moveDown(0.35);
  const yJ = doc.y;
  const yAfter = pdfDrawJourneyStrip(doc, item, m.left, yJ, pageInnerWidth(doc));
  doc.y = yAfter;
  doc.moveDown(0.2);

  pdfSectionTitle(doc, "Article particulars — booking & delivery");
  pdfAlignedFieldGrid(doc, pdfBookingFieldRows(bd, consignment));

  pdfSectionTitle(doc, `Chronological event log (${Array.isArray(item.tracking_details) ? item.tracking_details.length : 0} rows)`);
  const events = Array.isArray(item.tracking_details) ? item.tracking_details : [];
  if (!events.length) {
    doc.fontSize(9.5).fillColor(PDF_COLORS.muted).text("No tracking events returned for this article.");
    doc.fillColor(PDF_COLORS.text);
  } else {
    pdfDrawEventTableHeader(doc);
    events.forEach((ev, i) => {
      ensurePageSpace(doc, 680);
      if (doc.y > 670) {
        doc.addPage();
        pdfDrawContinuationLine(doc);
        pdfDrawEventTableHeader(doc);
      }
      pdfDrawEventTableRow(doc, ev, i);
    });
  }

  pdfRenderFooter(doc);
  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildPdfMulti(normalizedTracking) {
  const items = getItems(normalizedTracking);
  const rows = buildSummaryRowsFromItems(items);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  pdfDrawIndiaPostBanner(doc, {
    subtitle: `Bulk tracking summary · ${rows.length} consignment(s) · Department of Posts, Government of India`
  });
  pdfDrawGeneratedStamp(doc);
  doc.fontSize(8.5).fillColor(PDF_COLORS.muted).font("Helvetica").text("Each block: journey + article particulars + last-scan summary.", {
    align: "left"
  });
  doc.moveDown(0.5);
  doc.fillColor(PDF_COLORS.text);

  if (!rows.length) {
    doc.fontSize(11).text("No consignments to display.");
    pdfRenderFooter(doc);
    doc.end();
    return new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  const m = doc.page.margins;

  rows.forEach((r, idx) => {
    const it = items[idx];
    if (!it) return;
    if (doc.y > 680) {
      doc.addPage();
      pdfDrawContinuationLine(doc);
    }

    const bd = it.booking_details || {};
    const cons = safeString(it.consignment || bd.article_number);

    doc.fontSize(11).font("Helvetica-Bold").fillColor(PDF_COLORS.navy).text(`${r.Consignment}`);
    doc.font("Helvetica").fontSize(9.5).fillColor(PDF_COLORS.text).text(`Status: ${r.Status || "—"} · Category: ${r.Category}`);
    doc.moveDown(0.15);
    const yJ = doc.y;
    const yAfter = pdfDrawJourneyStrip(doc, it, m.left, yJ, pageInnerWidth(doc));
    doc.y = yAfter;
    doc.moveDown(0.15);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(PDF_COLORS.navy).text("Article particulars");
    doc.moveDown(0.2);
    pdfAlignedFieldGrid(doc, pdfBookingFieldRows(bd, cons));
    doc.fontSize(8).fillColor(PDF_COLORS.muted).font("Helvetica");
    doc.text(
      `Last scan: ${r.Last_Event || "—"} @ ${r.Last_Office || "—"} · ${r.Last_Event_ISO || ""} ${r.Last_Event_Time || ""}`
    );
    doc.fillColor(PDF_COLORS.text);
    doc.moveDown(0.45);
    doc.strokeColor(PDF_COLORS.line).moveTo(m.left, doc.y).lineTo(doc.page.width - m.right, doc.y).stroke();
    doc.moveDown(0.45);
  });

  pdfRenderFooter(doc);
  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function buildPdf(normalizedTracking) {
  const items = getItems(normalizedTracking);
  if (items.length === 1) {
    return buildPdfSingleItem(items[0]);
  }
  return buildPdfMulti(normalizedTracking);
}

async function buildReportBuffer(format, normalizedTracking) {
  if (format === "csv") return buildCsv(normalizedTracking);
  if (format === "xlsx") return buildMasterXlsxBuffer(normalizedTracking);
  return await buildPdf(normalizedTracking);
}

module.exports = {
  createDownloadMeta,
  buildReportBuffer,
  buildUploadTemplateBuffer,
  /** Exposed for tests / documentation — same buffer as XLSX download */
  buildMasterXlsxBuffer
};

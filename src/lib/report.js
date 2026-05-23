"use strict";

/**
 * reportBuilder.js
 * India Post — exact official "Consignment/MO Tracking Report" format.
 */

const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

let loadPdfLogos;
try { ({ loadPdfLogos } = require("./pdfLogos")); }
catch { loadPdfLogos = async () => ({}); }

let formatEventRemarksForDisplay;
try { ({ formatEventRemarksForDisplay } = require("./eventRemarks")); }
catch { formatEventRemarksForDisplay = (ev) => (ev && ev.remarks) ? ev.remarks : ""; }

let getConsignmentCategory;
try { ({ getConsignmentCategory } = require("./consignmentCategory")); }
catch { getConsignmentCategory = () => "Unknown"; }

let SHEET_CONSIGNMENTS, SHEET_ALL_EVENTS, SHEET_EXPORT_INFO,
    PDF_FOOTER_NOTE, UPLOAD_COLUMN_CONSIGNMENT, EXAMPLE_CONSIGNMENT;
try {
  ({ SHEET_CONSIGNMENTS, SHEET_ALL_EVENTS, SHEET_EXPORT_INFO,
     PDF_FOOTER_NOTE, UPLOAD_COLUMN_CONSIGNMENT, EXAMPLE_CONSIGNMENT } = require("./reportFormats"));
} catch {
  SHEET_CONSIGNMENTS = "Consignments"; SHEET_ALL_EVENTS = "All Events";
  SHEET_EXPORT_INFO = "Export Info";
  PDF_FOOTER_NOTE = "Generated via India Post tracking.";
  UPLOAD_COLUMN_CONSIGNMENT = "Consignment"; EXAMPLE_CONSIGNMENT = "EX123456789IN";
}

const C = {
  headerRed: "#C62829", border: "#d7d7d7",
  darkText: "#1a1a1a", greyLabel: "#888888",
  pillBg: "#dbeafe", pillText: "#1e40af", pillBorder: "#93c5fd",
  cnBoxBg: "#d9edf7", cnBoxText: "#0b4f71",
  tblHeaderBg: "#f3f3f3", tblAltBg: "#fafafa",
};

const PAGE_W = 595.28, PAGE_H = 841.89;
const ML = 36, MR = 36, MT = 28, MB = 36;
const IW = PAGE_W - ML - MR;

const pad2  = (n) => String(n).padStart(2, "0");
const safeS = (v) => (v == null) ? "" : String(v);
const gap   = (doc, pts) => { doc.y += pts; };

function ensureSpace(doc, need = 80) {
  if (doc.y + need > PAGE_H - MB) { doc.addPage(); doc.y = MT; }
}
function hRule(doc, color = C.border, thickness = 0.5) {
  doc.save().strokeColor(color).lineWidth(thickness)
     .moveTo(ML, doc.y).lineTo(PAGE_W - MR, doc.y).stroke().restore();
  doc.y += 1;
}

function fmtDate(d) {
  if (!d) return "";
  try {
    const x = new Date(String(d));
    if (isNaN(x.getTime())) return safeS(d);
    return `${pad2(x.getDate())}/${pad2(x.getMonth()+1)}/${x.getFullYear()}, ` +
           `${pad2(x.getHours())}:${pad2(x.getMinutes())}:${pad2(x.getSeconds())}`;
  } catch { return safeS(d); }
}

function fmtShortDate(d) {
  if (!d) return "";
  try {
    const x = new Date(String(d));
    if (isNaN(x.getTime())) return safeS(d);
    return `${pad2(x.getDate())}/${pad2(x.getMonth()+1)}/${x.getFullYear()}`;
  } catch { return safeS(d); }
}

function timestampForFilename(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}` +
         `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
function sanitizeFilenamePart(s) {
  const u = safeS(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return u.slice(0, 40) || "report";
}
function getItems(nt) { return nt && Array.isArray(nt.items) ? nt.items : []; }

// ── HEADER ────────────────────────────────────────────────────────────────────
function drawHeader(doc, logos = {}) {
  let textX = ML;
  const y = MT;
  if (logos.ashok) { doc.image(logos.ashok, ML, y, { height: 56 }); textX = ML + 52; }
  if (logos.indiaPost) {
    const ipX = logos.ashok ? ML + 54 : ML;
    doc.image(logos.indiaPost, ipX, y + 6, { height: 42 });
    textX = ipX + 170;
  } else if (logos.ashok) { textX = ML + 62; }
  const tx = Math.max(textX, (logos.ashok || logos.indiaPost) ? ML + 220 : ML);
  doc.fillColor(C.headerRed).font("Helvetica-Bold").fontSize(14).text("Department of Posts", tx, y + 2);
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(11).text("Government of India", tx, y + 19);
  doc.fillColor("#000000").font("Helvetica").fontSize(8.5).text("Ministry of Communications", tx, y + 35);
  doc.y = y + 62;
  hRule(doc, C.border, 0.8);
  gap(doc, 6);
}

// ── GENERATED STAMP ───────────────────────────────────────────────────────────
function drawGeneratedStamp(doc) {
  const now = new Date();
  const h24 = now.getHours();
  const hh  = h24 % 12 || 12;
  const stamp = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}, ` +
                `${hh}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())} ${h24 < 12 ? "am" : "pm"}`;
  doc.fillColor(C.greyLabel).font("Helvetica").fontSize(7.5)
     .text(`Generated through Indiapost website on: ${stamp}`, ML, doc.y);
  gap(doc, 10);
}

// ── TITLE ─────────────────────────────────────────────────────────────────────
function drawTitle(doc) {
  doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(17)
     .text("Consignment/MO Tracking Report", ML, doc.y);
  gap(doc, 10);
}

// ── CONSIGNMENT NUMBER BOX ────────────────────────────────────────────────────
function drawConsignmentRow(doc, cn) {
  const y = doc.y, boxH = 26, labelW = 172, boxX = ML + labelW + 4;
  const boxW = Math.min(doc.widthOfString(safeS(cn), { fontSize: 12 }) + 24, 240);
  doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(11)
     .text("Consignment/MO Number:", ML, y + 7, { width: labelW });
  doc.roundedRect(boxX, y, boxW, boxH, 4).fill(C.cnBoxBg);
  doc.fillColor(C.cnBoxText).font("Helvetica-Bold").fontSize(12)
     .text(safeS(cn) || "—", boxX + 10, y + 7);
  doc.y = y + boxH + 10;
}

// ── INFO GRID ─────────────────────────────────────────────────────────────────
// Row 1: Article Number (left half) | Article Type with blue pill (right half)
// Row 2: Booked At | Booked On | Destination          (3 equal cols)
// Row 3: Origin Pincode | Delivered On | Dest Pincode (3 equal cols)
function drawInfoGrid(doc, bd, cons) {
  const PAD_L = 10, PAD_T = 8;
  const LS = 8, VS = 10;    // label fontSize, value fontSize
  const col3W = IW / 3;
  const halfW = IW / 2;

  // ── Row 1 ──────────────────────────────────────────────────────────────────
  const r1H = 54, r1Y = doc.y;
  doc.rect(ML, r1Y, IW, r1H).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.moveTo(ML + halfW, r1Y).lineTo(ML + halfW, r1Y + r1H)
     .strokeColor(C.border).lineWidth(0.5).stroke();

  // Article Number
  doc.fillColor(C.greyLabel).font("Helvetica").fontSize(LS)
     .text("Article Number:", ML + PAD_L, r1Y + PAD_T);
  doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(VS)
     .text(safeS(bd.article_number) || cons || "—", ML + PAD_L, r1Y + PAD_T + 14);

  // Article Type
  const c2x = ML + halfW + PAD_L;
  doc.fillColor(C.greyLabel).font("Helvetica").fontSize(LS)
     .text("Article Type:", c2x, r1Y + PAD_T);
  const artType = safeS(bd.article_type);
  if (artType) {
    const pw = Math.min(doc.widthOfString(artType, { fontSize: 9 }) + 18, halfW - 20);
    const py = r1Y + PAD_T + 12, ph = 18;
    doc.roundedRect(c2x, py, pw, ph, 4).fill(C.pillBg);
    doc.roundedRect(c2x, py, pw, ph, 4).strokeColor(C.pillBorder).lineWidth(0.5).stroke();
    doc.fillColor(C.pillText).font("Helvetica-Bold").fontSize(9)
       .text(artType, c2x + 9, py + 4, { width: pw - 12 });
  } else {
    doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(VS)
       .text("—", c2x, r1Y + PAD_T + 14);
  }

  // ── Row 2 ──────────────────────────────────────────────────────────────────
  const r2H = 52, r2Y = r1Y + r1H;
  doc.rect(ML, r2Y, IW, r2H).strokeColor(C.border).lineWidth(0.5).stroke();
  [1, 2].forEach(i => doc.moveTo(ML + i * col3W, r2Y).lineTo(ML + i * col3W, r2Y + r2H)
     .strokeColor(C.border).lineWidth(0.5).stroke());
  [
    ["Booked At",   safeS(bd.booked_at)],
    ["Booked On",   fmtDate(bd.booked_on)],
    ["Destination", safeS(bd.delivery_location)],
  ].forEach(([label, val], i) => {
    const cx = ML + i * col3W + PAD_L;
    doc.fillColor(C.greyLabel).font("Helvetica").fontSize(LS).text(label + ":", cx, r2Y + PAD_T);
    doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(VS)
       .text(val || "—", cx, r2Y + PAD_T + 13, { width: col3W - PAD_L - 4 });
  });

  // ── Row 3 ──────────────────────────────────────────────────────────────────
  const r3H = 52, r3Y = r2Y + r2H;
  doc.rect(ML, r3Y, IW, r3H).strokeColor(C.border).lineWidth(0.5).stroke();
  [1, 2].forEach(i => doc.moveTo(ML + i * col3W, r3Y).lineTo(ML + i * col3W, r3Y + r3H)
     .strokeColor(C.border).lineWidth(0.5).stroke());
  [
    ["Origin Pincode",      safeS(bd.origin_pincode)],
    ["Delivered On",        bd.delivery_confirmed_on ? fmtDate(bd.delivery_confirmed_on) : ""],
    ["Destination Pincode", safeS(bd.destination_pincode)],
  ].forEach(([label, val], i) => {
    const cx = ML + i * col3W + PAD_L;
    doc.fillColor(C.greyLabel).font("Helvetica").fontSize(LS).text(label + ":", cx, r3Y + PAD_T);
    doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(VS)
       .text(val || "—", cx, r3Y + PAD_T + 13, { width: col3W - PAD_L - 4 });
  });

  doc.y = r3Y + r3H + 14;
}

// ── EVENT COUNT ───────────────────────────────────────────────────────────────
function drawEventCount(doc, count) {
  doc.fillColor(C.darkText).font("Helvetica").fontSize(10)
     .text(String(count), ML, doc.y);
  gap(doc, 6);
}

// ── EVENT TABLE ───────────────────────────────────────────────────────────────
const EV_COLS = [
  { label: "Event",   w: 0.30 },
  { label: "Date",    w: 0.17 },
  { label: "Time",    w: 0.12 },
  { label: "Office",  w: 0.24 },
  { label: "Remarks", w: 0.17 },
];
function colW() { return EV_COLS.map(c => c.w * IW); }

function drawEventTableHeader(doc) {
  const widths = colW(), y = doc.y, hdrH = 24;
  doc.rect(ML, y, IW, hdrH).fill(C.tblHeaderBg);
  let x = ML;
  EV_COLS.forEach((c, i) => {
    doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(9.5)
       .text(c.label, x + 6, y + 7);
    x += widths[i];
  });
  doc.rect(ML, y, IW, hdrH).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.y = y + hdrH;
}

function drawEventRow(doc, ev, isAlt) {
  const widths = colW();
  const remark = formatEventRemarksForDisplay(ev);
  const vals = [
    safeS(ev.event),
    fmtShortDate(ev.date),
    safeS(ev.time),
    safeS(ev.office),
    remark || "-",    // official shows "-" when empty
  ];
  doc.font("Helvetica").fontSize(9);
  const rowH = Math.max(28, ...vals.map((v, i) => {
    const w = Math.max(1, widths[i] - 12);
    const h = doc.heightOfString(v, { width: w });
    return (isFinite(h) ? h : 12) + 10;
  }));
  ensureSpace(doc, rowH + 6);
  const y = doc.y;
  if (isAlt) doc.rect(ML, y, IW, rowH).fill(C.tblAltBg);
  let x = ML;
  vals.forEach((v, i) => {
    doc.fillColor(C.darkText).font("Helvetica").fontSize(9)
       .text(v, x + 6, y + 6, { width: widths[i] - 12 });
    x += widths[i];
  });
  doc.rect(ML, y, IW, rowH).strokeColor(C.border).lineWidth(0.5).stroke();
  doc.y = y + rowH;
}

// ── CONTINUATION HEADER ───────────────────────────────────────────────────────
function drawContinuationHeader(doc, cons) {
  doc.y = MT;
  doc.fillColor(C.greyLabel).font("Helvetica").fontSize(8)
     .text(`India Post · Tracking report (continued) · ${cons}`, ML, doc.y);
  gap(doc, 4); hRule(doc, C.border); gap(doc, 6);
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function drawFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = PAGE_H - 20;
    doc.font("Helvetica").fontSize(7).fillColor(C.greyLabel)
       .text("https://www.indiapost.gov.in", ML, fy, { width: IW, align: "left" });
    doc.font("Helvetica").fontSize(7).fillColor(C.greyLabel)
       .text(`${i + 1}/${range.count}`, ML, fy, { width: IW, align: "right" });
  }
}

// ── SINGLE ARTICLE PDF ────────────────────────────────────────────────────────
async function buildPdfSingleItem(item) {
  const logos = await loadPdfLogos();
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "A4", margins: { left: ML, right: MR, top: MT, bottom: MB }, bufferPages: true
    });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));

    const bd   = item.booking_details || {};
    const cons = safeS(item.consignment || bd.article_number);
    const evs  = Array.isArray(item.tracking_details) ? item.tracking_details : [];

    drawHeader(doc, logos);
    drawGeneratedStamp(doc);
    drawTitle(doc);
    drawConsignmentRow(doc, cons);
    drawInfoGrid(doc, bd, cons);
    drawEventCount(doc, evs.length);

    if (evs.length) {
      ensureSpace(doc, 50);
      drawEventTableHeader(doc);
      evs.forEach((ev, i) => {
        if (doc.y > PAGE_H - MB - 32) {
          doc.addPage();
          drawContinuationHeader(doc, cons);
          drawEventTableHeader(doc);
        }
        drawEventRow(doc, ev, i % 2 === 1);
      });
    } else {
      doc.fillColor(C.greyLabel).font("Helvetica").fontSize(9)
         .text("No tracking events found.", ML, doc.y);
    }

    drawFooter(doc);
    doc.end();
  });
}

// ── MULTI ARTICLE PDF ─────────────────────────────────────────────────────────
async function buildPdfMulti(nt) {
  const items = getItems(nt);
  const logos = await loadPdfLogos();
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "A4", margins: { left: ML, right: MR, top: MT, bottom: MB }, bufferPages: true
    });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));

    drawHeader(doc, logos);
    drawGeneratedStamp(doc);
    doc.fillColor(C.darkText).font("Helvetica-Bold").fontSize(17)
       .text("Consignment/MO Tracking Report", ML, doc.y);
    gap(doc, 4);
    doc.fillColor(C.greyLabel).font("Helvetica").fontSize(9)
       .text(`Bulk tracking summary · ${items.length} consignment(s)`, ML, doc.y);
    gap(doc, 14);

    items.forEach((item, idx) => {
      const bd   = item.booking_details || {};
      const cons = safeS(item.consignment || bd.article_number);
      const evs  = Array.isArray(item.tracking_details) ? item.tracking_details : [];
      ensureSpace(doc, 160);
      if (idx > 0) {
        doc.moveTo(ML, doc.y).lineTo(PAGE_W - MR, doc.y)
           .strokeColor(C.border).lineWidth(0.5).stroke();
        gap(doc, 10);
      }
      drawConsignmentRow(doc, cons);
      drawInfoGrid(doc, bd, cons);
      drawEventCount(doc, evs.length);
      if (evs.length) {
        ensureSpace(doc, 50);
        drawEventTableHeader(doc);
        evs.forEach((ev, i) => {
          if (doc.y > PAGE_H - MB - 32) {
            doc.addPage();
            drawContinuationHeader(doc, cons);
            drawEventTableHeader(doc);
          }
          drawEventRow(doc, ev, i % 2 === 1);
        });
      }
      gap(doc, 16);
    });

    drawFooter(doc);
    doc.end();
  });
}

async function buildPdf(nt) {
  const items = getItems(nt);
  if (!items.length) throw new Error("No tracking items");
  return items.length === 1 ? buildPdfSingleItem(items[0]) : buildPdfMulti(nt);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────
function formatDateIsoSafe(d) {
  if (!d) return "";
  try { const x = new Date(String(d)); return isNaN(x.getTime()) ? safeS(d) : x.toISOString(); }
  catch { return safeS(d); }
}
function formatDateDisplay(d) {
  if (!formatDateIsoSafe(d)) return "";
  try { return new Date(String(d)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return safeS(d); }
}
function buildSummaryRows(items) {
  return items.map((it, idx) => {
    const bd = it.booking_details || {}, cat = getConsignmentCategory(it.status), le = it.last_event || {};
    const cons = safeS(it.consignment || bd.article_number);
    return {
      Row: idx + 1, Category: cat, Consignment: cons, Status: safeS(it.status),
      Article_Type: safeS(bd.article_type), Booked_At: safeS(bd.booked_at),
      Booked_On_ISO: formatDateIsoSafe(bd.booked_on), Booked_On_Display: formatDateDisplay(bd.booked_on),
      Origin_PIN: safeS(bd.origin_pincode), Dest_PIN: safeS(bd.destination_pincode),
      Delivery_Location: safeS(bd.delivery_location),
      Tariff: bd.tariff != null && bd.tariff !== "" ? bd.tariff : "",
      Delivery_Confirmed_ISO: formatDateIsoSafe(bd.delivery_confirmed_on),
      Delivery_Confirmed_Display: formatDateDisplay(bd.delivery_confirmed_on),
      Last_Event: safeS(le.event), Last_Event_ISO: formatDateIsoSafe(le.date),
      Last_Event_Time: safeS(le.time), Last_Office: safeS(le.office),
      Tracking_Event_Count: Array.isArray(it.tracking_details) ? it.tracking_details.length : 0,
    };
  });
}
function buildEventRows(items) {
  const out = [];
  for (const it of items) {
    const cat = getConsignmentCategory(it.status);
    const cons = safeS(it.consignment || (it.booking_details && it.booking_details.article_number));
    (Array.isArray(it.tracking_details) ? it.tracking_details : []).forEach((e, i) => {
      out.push({ Consignment: cons, Category: cat, Status: safeS(it.status), Line: i + 1,
        Event_Date_ISO: formatDateIsoSafe(e.date), Event_Time: safeS(e.time),
        Office_ID: e.officeid != null ? e.officeid : "", Office: safeS(e.office),
        Event: safeS(e.event), Remarks: safeS(e.remarks) });
    });
  }
  return out;
}
function buildMasterXlsxBuffer(nt) {
  const items = getItems(nt);
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(buildSummaryRows(items).length ? buildSummaryRows(items) : [{ Info: "No rows" }]);
  ws1["!cols"] = [5,14,16,14,12,28,24,24,10,10,22,8,28,24,36,28,12,28,10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_CONSIGNMENTS);
  const ws2 = XLSX.utils.json_to_sheet(buildEventRows(items).length ? buildEventRows(items) : [{ Info: "No events" }]);
  ws2["!cols"] = [16,14,14,6,28,12,10,36,40,20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws2, SHEET_ALL_EVENTS);
  const ws3 = XLSX.utils.json_to_sheet([
    { Key: "Generated_UTC", Value: new Date().toISOString() },
    { Key: "Item_Count", Value: items.length },
    { Key: "Consignments_Sheet", Value: "One row per article" },
    { Key: "All_Events_Sheet", Value: "One row per scan/event" },
  ]);
  ws3["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws3, SHEET_EXPORT_INFO);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function csvEscape(v) {
  const s = safeS(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildCsv(nt) {
  const rows = buildSummaryRows(getItems(nt));
  if (!rows.length) return Buffer.from("Info\r\nNo rows\r\n", "utf8");
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(","));
  return Buffer.from(lines.join("\r\n"), "utf8");
}

// ── UPLOAD TEMPLATE ───────────────────────────────────────────────────────────
function buildUploadTemplateBuffer() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[UPLOAD_COLUMN_CONSIGNMENT], [EXAMPLE_CONSIGNMENT]]);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_CONSIGNMENTS);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
function createDownloadMeta(format, opts = {}) {
  const stamp = timestampForFilename();
  const slug  = opts.consignment ? sanitizeFilenamePart(opts.consignment) : null;
  const base  = slug ? `tracking-${slug}` : "tracking-report";
  if (format === "pdf")  return { contentType: "application/pdf", filename: `${base}-${stamp}.pdf` };
  if (format === "xlsx") return { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `${base}-${stamp}.xlsx` };
  return { contentType: "text/csv; charset=utf-8", filename: `${base}-${stamp}.csv` };
}

async function buildReportBuffer(format, nt) {
  if (format === "csv")  return buildCsv(nt);
  if (format === "xlsx") return buildMasterXlsxBuffer(nt);
  return buildPdf(nt);
}

module.exports = { createDownloadMeta, buildReportBuffer, buildUploadTemplateBuffer, buildMasterXlsxBuffer };
"use strict";
/**
 * reportBuilder.js
 *
 * Drop-in replacement for the existing PDF / XLSX / CSV builder.
 * PDF output now matches the official India Post
 * "Consignment/MO Tracking Report" format exactly.
 *
 * External deps: pdfkit, xlsx  (already in your package.json)
 * Internal deps: consignmentCategory, reportFormats  (journeyRace milestones disabled)
 *
 * Exports (same surface as before):
 *   createDownloadMeta(format, opts)
 *   buildReportBuffer(format, normalizedTracking)   → Promise<Buffer>
 *   buildUploadTemplateBuffer()                     → Buffer
 *   buildMasterXlsxBuffer(normalizedTracking)       → Buffer
 */

const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

// ── bring in your existing helpers (paths unchanged) ─────────────────────────
// If these modules don't exist in the sandbox, we inline stubs so the file
// can be tested standalone; in production they resolve normally.
let getConsignmentCategory, getShipmentDisplayLabelFromItem;
// let journeyStagesWithState, isRtoOrReturn;
let SHEET_CONSIGNMENTS, SHEET_ALL_EVENTS, SHEET_EXPORT_INFO;
let PDF_FOOTER_NOTE, UPLOAD_COLUMN_CONSIGNMENT, EXAMPLE_CONSIGNMENT;

try {
  ({ getConsignmentCategory, getShipmentDisplayLabelFromItem } = require("./consignmentCategory"));
} catch {
  getConsignmentCategory = () => "Unknown";
  getShipmentDisplayLabelFromItem = (it) => (it && it.status) || "Transit";
}

// Journey milestones disabled — journeyRace strip not loaded
// try {
//   ({ journeyStagesWithState, isRtoOrReturn } = require("./journeyRace"));
// } catch {
//   journeyStagesWithState = () => [];
//   isRtoOrReturn = () => false;
// }

try {
  ({
    SHEET_CONSIGNMENTS, SHEET_ALL_EVENTS, SHEET_EXPORT_INFO,
    PDF_FOOTER_NOTE, UPLOAD_COLUMN_CONSIGNMENT, EXAMPLE_CONSIGNMENT,
  } = require("./reportFormats"));
} catch {
  SHEET_CONSIGNMENTS       = "Consignments";
  SHEET_ALL_EVENTS         = "All Events";
  SHEET_EXPORT_INFO        = "Export Info";
  PDF_FOOTER_NOTE          = "Generated via India Post tracking. For official records visit indiapost.gov.in.";
  UPLOAD_COLUMN_CONSIGNMENT = "Consignment";
  EXAMPLE_CONSIGNMENT      = "EX123456789IN";
}

// ─────────────────────────────────────────────────────────────────────────────
//  COLOUR PALETTE  (official India Post palette)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // Header / branding
  headerRed:     "#C0392B",   // "Department of Posts" text
  headerBorder:  "#cccccc",   // thin HR lines

  // Page chrome
  darkText:      "#1a1a1a",
  greyLabel:     "#7f8c8d",
  lightBorder:   "#cccccc",
  pageBg:        "#ffffff",

  // Consignment number box
  cnBoxBg:       "#d6eaf8",
  cnBoxText:     "#1a5276",

  // Info / booking grid boxes
  cellBg:        "#ffffff",
  cellBorder:    "#cccccc",

  // Event table
  tableHeaderBg: "#f0f0f0",
  tableRowAlt:   "#fafafa",
  tableText:     "#1a1a1a",

  // Journey strip colours (disabled with drawJourneyStrip)
  // greenBg:       "#dcfce7",
  // greenBorder:   "#16a34a",
  // greenText:     "#14532d",
  // blueRing:      "#2563eb",
  // stripDefault:  "#f1f5f9",
  // stripBorder:   "#cbd5e1",
  // navy:          "#1e3a8a",
  // muted:         "#64748b",
};

// ─────────────────────────────────────────────────────────────────────────────
//  GENERIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, "0"); }

function timestampForFilename(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`
       + `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function formatDateIsoSafe(d) {
  if (!d && d !== 0) return "";
  try {
    const x = new Date(String(d));
    if (isNaN(x.getTime()) || x.getFullYear() < 1900) return String(d);
    return x.toISOString();
  } catch { return String(d); }
}

function formatDateDisplay(d) {
  if (!formatDateIsoSafe(d)) return "";
  try {
    return new Date(String(d)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch { return String(d); }
}

/** Format a date for PDF cells — "DD Mon YYYY, HH:MM" */
function fmtPdfDate(d) {
  try {
    if (!d) return "—";
    const x = new Date(d);
    if (isNaN(x.getTime())) return safeStr(d);
    return x.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch { return safeStr(d); }
}

/** Format exactly as shown on the official site: "DD/MM/YYYY, HH:MM:SS" */
function fmtOfficialDate(d) {
  if (!d) return "—";
  try {
    const x = new Date(String(d));
    if (isNaN(x.getTime())) return safeStr(d);
    const dd = pad2(x.getDate());
    const mm = pad2(x.getMonth() + 1);
    const yyyy = x.getFullYear();
    const hh = pad2(x.getHours());
    const mi = pad2(x.getMinutes());
    const ss = pad2(x.getSeconds());
    return `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss}`;
  } catch { return safeStr(d); }
}

function csvEscape(v) {
  const s = safeStr(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getItems(nt) {
  return nt && Array.isArray(nt.items) ? nt.items : [];
}

function sanitizeFilenamePart(s) {
  const u = safeStr(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return u.slice(0, 40) || "report";
}

// ─────────────────────────────────────────────────────────────────────────────
//  XLSX / CSV  (identical logic to original — untouched)
// ─────────────────────────────────────────────────────────────────────────────
function buildSummaryRowsFromItems(items) {
  return items.map((it, idx) => {
    const bd  = it.booking_details || {};
    const cat = getShipmentDisplayLabelFromItem(it);
    const le  = it.last_event || {};
    const cons = safeStr(it.consignment || bd.article_number);
    return {
      Row:                      idx + 1,
      Category:                 cat,
      Consignment:              cons,
      Status:                   safeStr(it.status),
      Article_Type:             safeStr(bd.article_type),
      Booked_At:                safeStr(bd.booked_at),
      Booked_On_ISO:            formatDateIsoSafe(bd.booked_on),
      Booked_On_Display:        formatDateDisplay(bd.booked_on),
      Origin_PIN:               safeStr(bd.origin_pincode),
      Dest_PIN:                 safeStr(bd.destination_pincode),
      Delivery_Location:        safeStr(bd.delivery_location),
      Tariff:                   bd.tariff != null && bd.tariff !== "" ? bd.tariff : "",
      Delivery_Confirmed_ISO:   formatDateIsoSafe(bd.delivery_confirmed_on),
      Delivery_Confirmed_Display: formatDateDisplay(bd.delivery_confirmed_on),
      Last_Event:               safeStr(le.event),
      Last_Event_ISO:           formatDateIsoSafe(le.date),
      Last_Event_Time:          safeStr(le.time),
      Last_Office:              safeStr(le.office),
      Tracking_Event_Count:     Array.isArray(it.tracking_details) ? it.tracking_details.length : 0,
    };
  });
}

function buildEventRowsFromItems(items) {
  const out = [];
  for (const it of items) {
    const cat  = getShipmentDisplayLabelFromItem(it);
    const cons = safeStr(it.consignment || (it.booking_details && it.booking_details.article_number));
    (Array.isArray(it.tracking_details) ? it.tracking_details : []).forEach((e, i) => {
      out.push({
        Consignment:    cons,
        Category:       cat,
        Status:         safeStr(it.status),
        Line:           i + 1,
        Event_Date_ISO: formatDateIsoSafe(e.date),
        Event_Time:     safeStr(e.time),
        Office_ID:      e.officeid != null ? e.officeid : "",
        Office:         safeStr(e.office),
        Event:          safeStr(e.event),
      });
    });
  }
  return out;
}

function buildMetaRows(nt) {
  return [
    { Key: "Generated_UTC",      Value: new Date().toISOString() },
    { Key: "Upstream_Message",   Value: safeStr(nt && nt.upstream_message) },
    { Key: "Item_Count",         Value: getItems(nt).length },
    { Key: "Consignments_Sheet", Value: "One row per article. Upload template: GET /track/upload-template" },
    { Key: "All_Events_Sheet",   Value: "One row per scan/event (full timeline)" },
  ];
}

function buildMasterXlsxBuffer(nt) {
  const items       = getItems(nt);
  const summaryRows = buildSummaryRowsFromItems(items);
  const eventRows   = buildEventRowsFromItems(items);
  const metaRows    = buildMetaRows(nt);
  const wb          = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Info: "No rows" }]);
  ws1["!cols"] = [5,14,16,14,12,28,24,24,10,10,22,8,28,24,36,28,12,28,36,10].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_CONSIGNMENTS);

  const ws2 = XLSX.utils.json_to_sheet(eventRows.length ? eventRows : [{ Info: "No events" }]);
  ws2["!cols"] = [16,14,14,6,28,12,10,36,40].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, SHEET_ALL_EVENTS);

  const ws3 = XLSX.utils.json_to_sheet(metaRows);
  ws3["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws3, SHEET_EXPORT_INFO);

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

function buildUploadTemplateBuffer() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[UPLOAD_COLUMN_CONSIGNMENT], [EXAMPLE_CONSIGNMENT]]);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_CONSIGNMENTS);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

function buildCsv(nt) {
  const rows = buildSummaryRowsFromItems(getItems(nt));
  if (!rows.length) return Buffer.from("Info\r\nNo rows\r\n", "utf8");
  const headers = Object.keys(rows[0]);
  const lines   = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(","));
  return Buffer.from(lines.join("\r\n"), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
//  PDF  —  Official India Post "Consignment/MO Tracking Report" format
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;  // A4 points
const PAGE_H = 841.89;
const MARGIN = { left: 42, right: 42, top: 36, bottom: 36 };
const INNER_W = PAGE_W - MARGIN.left - MARGIN.right;

// ── tiny drawing utilities ────────────────────────────────────────────────────

/** Move doc.y down by `pts` points. */
function gap(doc, pts) { doc.y += pts; }

/** Draw a full-width horizontal rule at current Y. */
function hRule(doc, color = C.lightBorder, thickness = 0.5) {
  doc.save()
     .strokeColor(color)
     .lineWidth(thickness)
     .moveTo(MARGIN.left, doc.y)
     .lineTo(PAGE_W - MARGIN.right, doc.y)
     .stroke()
     .restore();
  doc.y += 1;
}

/** Ensure at least `need` pts remain on the page; add a new page if not. */
function ensureSpace(doc, need = 80) {
  if (doc.y + need > PAGE_H - MARGIN.bottom) {
    doc.addPage();
    doc.y = MARGIN.top;
  }
}

// ── OFFICIAL HEADER  (logo + org text + thin rule) ───────────────────────────
function drawOfficialHeader(doc) {
  const x = MARGIN.left;
  let y = MARGIN.top;

  // ── Government emblem placeholder (dark red circle) ───────────────────────
  const emblemR = 18;
  const emblemCx = x + emblemR;
  const emblemCy = y + emblemR + 2;
  doc.save()
     .circle(emblemCx, emblemCy, emblemR)
     .fill("#8B0000")
     .fillColor("#ffffff")
     .fontSize(7).font("Helvetica-Bold")
     .text("भारत", emblemCx - 9, emblemCy - 9, { width: 18, align: "center" })
     .text("INDIA", emblemCx - 9, emblemCy - 1, { width: 18, align: "center" })
     .restore();

  // ── Red envelope icon ─────────────────────────────────────────────────────
  const envX = emblemCx + emblemR + 8;
  const envY = y + 6;
  doc.save()
     .rect(envX, envY, 26, 18).fill(C.headerRed)
     .strokeColor("#ffffff").lineWidth(0.8)
     .moveTo(envX, envY).lineTo(envX + 13, envY + 9).lineTo(envX + 26, envY)
     .stroke()
     .restore();

  // ── Org text block ────────────────────────────────────────────────────────
  const txtX = envX + 34;
  const maxW = PAGE_W - MARGIN.right - txtX;

  doc.save()
     .fillColor(C.headerRed).font("Helvetica-Bold").fontSize(13)
     .text("Department of Posts", txtX, y + 2, { width: maxW })
     .fillColor(C.darkText).fontSize(10.5)
     .text("Government of India", txtX, y + 17, { width: maxW })
     .fillColor(C.darkText).font("Helvetica").fontSize(8.5)
     .text("Ministry of Communications", txtX, y + 31, { width: maxW })
     .restore();

  doc.y = y + emblemR * 2 + 12;
  hRule(doc, C.headerBorder, 0.8);
  gap(doc, 6);
}

// ── "Generated through Indiapost website on: …" stamp ────────────────────────
function drawGeneratedStamp(doc) {
  const now = new Date();
  const dd   = pad2(now.getDate());
  const mm   = pad2(now.getMonth() + 1);
  const yyyy = now.getFullYear();
  const hh   = pad2(now.getHours());
  const mi   = pad2(now.getMinutes());
  const ss   = pad2(now.getSeconds());
  const ampm = now.getHours() < 12 ? "am" : "pm";
  const stamp = `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss} ${ampm}`;

  doc.save()
     .fillColor(C.greyLabel).font("Helvetica").fontSize(7.8)
     .text(`Generated through Indiapost website on: ${stamp}`, MARGIN.left, doc.y, { width: INNER_W })
     .restore();
  gap(doc, 10);
}

// ── Report title ──────────────────────────────────────────────────────────────
function drawReportTitle(doc) {
  doc.save()
     .fillColor(C.darkText).font("Helvetica-Bold").fontSize(16)
     .text("Consignment/MO Tracking Report", MARGIN.left, doc.y, { width: INNER_W })
     .restore();
  gap(doc, 8);
}

// ── Consignment number row with blue pill box ─────────────────────────────────
function drawConsignmentNumber(doc, cn) {
  const labelW = 155;
  const boxPadH = 5;
  const boxPadV = 4;
  const boxH    = 22;
  const x = MARGIN.left;
  const y = doc.y;

  // label
  doc.save()
     .fillColor(C.darkText).font("Helvetica-Bold").fontSize(11)
     .text("Consignment/MO Number:", x, y + (boxH - 14) / 2, { width: labelW })
     .restore();

  // blue pill box
  const boxX = x + labelW + 6;
  const boxW = Math.min(doc.widthOfString(safeStr(cn)) + boxPadH * 2 + 12, INNER_W - labelW - 20);
  doc.save()
     .roundedRect(boxX, y, boxW, boxH, 4)
     .fill(C.cnBoxBg)
     .fillColor(C.cnBoxText).font("Helvetica-Bold").fontSize(12)
     .text(safeStr(cn) || "—", boxX + boxPadH, y + boxPadV, { width: boxW - boxPadH * 2 })
     .restore();

  doc.y = y + boxH + 10;
}

// ── 3-column info grid (Article / Type / Tariff / Booked …) ──────────────────
/**
 * Renders the two-row info box that appears in the official report:
 *   Row 1: Article Number | Article Type | Tariff
 *   Row 2: Booked At      | Booked On    | Destination
 *   Row 3: Origin Pincode | Delivered On | (blank)
 */
function drawInfoGrid(doc, bd, cons) {
  const cells = [
    // row 1
    [["Article Number:",  safeStr(bd.article_number) || cons || ""],
     ["Article Type:",    safeStr(bd.article_type) || ""],
     ["Tariff:",          bd.tariff != null && bd.tariff !== "" ? `\u20B9${bd.tariff}` : "\u20B90"]],
    // row 2
    [["Booked At:",       safeStr(bd.booked_at) || ""],
     ["Booked On:",       bd.booked_on ? fmtOfficialDate(bd.booked_on) : "-"],
     ["Destination:",     safeStr(bd.delivery_location) || ""]],
    // row 3
    [["Origin Pincode:",  safeStr(bd.origin_pincode) || ""],
     ["Delivered On:",    bd.delivery_confirmed_on ? fmtOfficialDate(bd.delivery_confirmed_on) : ""],
     ["", ""]],
  ];

  const colW   = INNER_W / 3;
  const padH   = 8;
  const padV   = 8;
  const labelH = 10;
  const rowH   = 46;   // fixed row height keeps grid uniform

  let y = doc.y;

  cells.forEach((row, ri) => {
    // draw outer border of this row
    doc.save()
       .rect(MARGIN.left, y, INNER_W, rowH)
       .strokeColor(C.cellBorder).lineWidth(0.5)
       .stroke()
       .restore();

    row.forEach(([label, value], ci) => {
      const cx = MARGIN.left + ci * colW;

      // vertical divider (skip first col)
      if (ci > 0) {
        doc.save()
           .strokeColor(C.cellBorder).lineWidth(0.5)
           .moveTo(cx, y).lineTo(cx, y + rowH)
           .stroke()
           .restore();
      }

      // label (grey, small)
      doc.save()
         .fillColor(C.greyLabel).font("Helvetica").fontSize(8)
         .text(label, cx + padH, y + padV, { width: colW - padH * 2 })
         .restore();

      // value (dark, bold, slightly larger)
      doc.save()
         .fillColor(C.darkText).font("Helvetica-Bold").fontSize(9.5)
         .text(safeStr(value) || (label ? "—" : ""), cx + padH, y + padV + labelH + 2, { width: colW - padH * 2 })
         .restore();
    });

    y += rowH;
  });

  doc.y = y + 12;
}

// ── Event table ───────────────────────────────────────────────────────────────
const EV_COLS = [
  { label: "Event",   wFrac: 0.33 },
  { label: "Date",    wFrac: 0.18 },
  { label: "Time",    wFrac: 0.13 },
  { label: "Office",  wFrac: 0.25 },
  { label: "Remarks", wFrac: 0.11 },
];

function evColWidths() {
  return EV_COLS.map(c => c.wFrac * INNER_W);
}

function drawEventTableHeader(doc) {
  ensureSpace(doc, 30);
  const widths = evColWidths();
  const hdrH   = 22;
  const y      = doc.y;
  let x        = MARGIN.left;

  doc.save()
     .rect(MARGIN.left, y, INNER_W, hdrH)
     .fill(C.tableHeaderBg)
     .restore();

  EV_COLS.forEach((col, i) => {
    doc.save()
       .fillColor(C.darkText).font("Helvetica-Bold").fontSize(9.5)
       .text(col.label, x + 6, y + 7, { width: widths[i] - 6 })
       .restore();
    x += widths[i];
  });

  // outer border
  doc.save()
     .rect(MARGIN.left, y, INNER_W, hdrH)
     .strokeColor(C.lightBorder).lineWidth(0.5)
     .stroke()
     .restore();

  doc.y = y + hdrH;
}

function drawEventRow(doc, ev, isAlt) {
  const widths  = evColWidths();
  const padL    = 6;
  const padV    = 5;
  const dateStr = ev.date  ? fmtOfficialDate(ev.date)  : "—";
  const timeStr = safeStr(ev.time)   || "—";
  const offStr  = safeStr(ev.office) || "—";
  const evtStr  = safeStr(ev.event)  || "—";
  const remStr  = safeStr(ev.remarks) || "-";

  // calculate row height from tallest cell
  doc.font("Helvetica").fontSize(9);
  const vals = [evtStr, dateStr, timeStr, offStr, remStr];
  const rowH = Math.max(
    28,
    ...vals.map((v, i) => doc.heightOfString(v, { width: widths[i] - padL * 2 }) + padV * 2)
  );

  ensureSpace(doc, rowH + 4);
  const y = doc.y;

  // background
  if (isAlt) {
    doc.save().rect(MARGIN.left, y, INNER_W, rowH).fill(C.tableRowAlt).restore();
  }

  // cell content
  let x = MARGIN.left;
  vals.forEach((val, i) => {
    doc.save()
       .fillColor(C.tableText).font("Helvetica").fontSize(9)
       .text(val, x + padL, y + padV, { width: widths[i] - padL * 2, lineBreak: true })
       .restore();
    x += widths[i];
  });

  // row border
  doc.save()
     .rect(MARGIN.left, y, INNER_W, rowH)
     .strokeColor(C.lightBorder).lineWidth(0.5)
     .stroke()
     .restore();

  doc.y = y + rowH;
}

// ── Journey strip (disabled) ──────────────────────────────────────────────────
/*
function drawJourneyStrip(doc, item) {
  const stages = journeyStagesWithState(item);
  if (!stages || !stages.length) return;

  gap(doc, 4);
  doc.save()
     .fillColor(C.navy).font("Helvetica-Bold").fontSize(8.5)
     .text("Journey milestones", MARGIN.left, doc.y, { width: INNER_W })
     .restore();
  gap(doc, 5);

  const n    = stages.length;
  const gap3 = 3;
  const boxW = (INNER_W - gap3 * (n - 1)) / n;
  const boxH = 20;
  const y0   = doc.y;
  let x      = MARGIN.left;

  for (const s of stages) {
    doc.save()
       .roundedRect(x, y0, boxW, boxH, 2)
       .fill(s.done ? C.greenBg : C.stripDefault)
       .roundedRect(x, y0, boxW, boxH, 2)
       .strokeColor(s.current ? C.blueRing : s.done ? C.greenBorder : C.stripBorder)
       .lineWidth(s.current ? 1.1 : 0.55)
       .stroke()
       .fillColor(s.done ? C.greenText : C.muted)
       .fontSize(6).font("Helvetica-Bold")
       .text(s.shortLabel || s.label || "", x + 2, y0 + 6, { width: boxW - 4, align: "center" })
       .restore();
    x += boxW + gap3;
  }

  doc.y = y0 + boxH + 10;
}
*/

// ── Footer ────────────────────────────────────────────────────────────────────
function drawFooter(doc, url) {
  gap(doc, 10);
  hRule(doc, C.headerBorder, 0.5);
  gap(doc, 3);
  const footer = url || `https://www.indiapost.gov.in/track-result/article-tracking/`;
  doc.save()
     .fillColor(C.greyLabel).font("Helvetica").fontSize(7)
     .text(footer, MARGIN.left, doc.y, { width: INNER_W, align: "left" })
     .restore();
  gap(doc, 3);

  // "page 1/1" right-aligned
  const total = doc.bufferedPageRange().count;
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.save()
       .fillColor(C.greyLabel).font("Helvetica").fontSize(7)
       .text(`${i + 1}/${range.count}`, MARGIN.left, PAGE_H - MARGIN.bottom + 5, { width: INNER_W, align: "right" })
       .restore();
  }
}

// ── Page-break header continuation line ───────────────────────────────────────
function drawContinuationHeader(doc) {
  doc.y = MARGIN.top;
  doc.save()
     .fillColor(C.greyLabel).font("Helvetica").fontSize(7.5)
     .text("India Post · Consignment/MO Tracking Report (continued)", MARGIN.left, doc.y, { width: INNER_W })
     .restore();
  gap(doc, 4);
  hRule(doc, C.lightBorder);
  gap(doc, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE-ARTICLE PDF
// ─────────────────────────────────────────────────────────────────────────────
function buildPdfSingleItem(item) {
  const doc    = new PDFDocument({ size: "A4", margins: MARGIN, bufferPages: true, autoFirstPage: true });
  const chunks = [];
  doc.on("data", c => chunks.push(c));

  const bd   = item.booking_details || {};
  const cons = safeStr(item.consignment || bd.article_number);
  const evs  = Array.isArray(item.tracking_details) ? item.tracking_details : [];

  // ── Page 1 ─────────────────────────────────────────────────────────────────
  drawOfficialHeader(doc);
  drawGeneratedStamp(doc);
  drawReportTitle(doc);
  drawConsignmentNumber(doc, cons);
  drawInfoGrid(doc, bd, cons);

  // try { drawJourneyStrip(doc, item); } catch (_) {}

  // ── Event table ────────────────────────────────────────────────────────────
  gap(doc, 6);
  if (evs.length) {
    ensureSpace(doc, 60);
    drawEventTableHeader(doc);
    evs.forEach((ev, i) => {
      if (doc.y > PAGE_H - MARGIN.bottom - 30) {
        doc.addPage();
        drawContinuationHeader(doc);
        drawEventTableHeader(doc);
      }
      drawEventRow(doc, ev, i % 2 === 1);
    });
  } else {
    doc.save()
       .fillColor(C.greyLabel).font("Helvetica").fontSize(9)
       .text("No tracking events found for this article.", MARGIN.left, doc.y, { width: INNER_W })
       .restore();
  }

  drawFooter(doc, item._footerUrl);

  doc.end();
  return new Promise(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));
}

// ─────────────────────────────────────────────────────────────────────────────
//  MULTI-ARTICLE PDF  (summary page + per-article section)
// ─────────────────────────────────────────────────────────────────────────────
function buildPdfMulti(nt) {
  const items = getItems(nt);
  const doc   = new PDFDocument({ size: "A4", margins: MARGIN, bufferPages: true, autoFirstPage: true });
  const chunks = [];
  doc.on("data", c => chunks.push(c));

  drawOfficialHeader(doc);
  drawGeneratedStamp(doc);

  // report title with count
  doc.save()
     .fillColor(C.darkText).font("Helvetica-Bold").fontSize(16)
     .text("Consignment/MO Tracking Report", MARGIN.left, doc.y, { width: INNER_W })
     .restore();
  gap(doc, 4);
  doc.save()
     .fillColor(C.greyLabel).font("Helvetica").fontSize(9)
     .text(`Bulk tracking summary · ${items.length} consignment(s)`, MARGIN.left, doc.y, { width: INNER_W })
     .restore();
  gap(doc, 12);

  items.forEach((item, idx) => {
    const bd   = item.booking_details || {};
    const cons = safeStr(item.consignment || bd.article_number);
    const evs  = Array.isArray(item.tracking_details) ? item.tracking_details : [];

    ensureSpace(doc, 120);

    // ── Article heading ───────────────────────────────────────────────────────
    doc.save()
       .fillColor(C.darkText).font("Helvetica-Bold").fontSize(13)
       .text(`${idx + 1}. ${cons || "—"}`, MARGIN.left, doc.y, { width: INNER_W })
       .restore();
    gap(doc, 6);

    drawConsignmentNumber(doc, cons);
    drawInfoGrid(doc, bd, cons);

    // try { drawJourneyStrip(doc, item); } catch (_) {}

    // ── Event table ────────────────────────────────────────────────────────────
    gap(doc, 4);
    if (evs.length) {
      ensureSpace(doc, 60);
      drawEventTableHeader(doc);
      evs.forEach((ev, i) => {
        if (doc.y > PAGE_H - MARGIN.bottom - 30) {
          doc.addPage();
          drawContinuationHeader(doc);
          drawEventTableHeader(doc);
        }
        drawEventRow(doc, ev, i % 2 === 1);
      });
    } else {
      doc.save()
         .fillColor(C.greyLabel).font("Helvetica").fontSize(9)
         .text("No tracking events.", MARGIN.left, doc.y, { width: INNER_W })
         .restore();
    }

    gap(doc, 14);
    if (idx < items.length - 1) hRule(doc, C.lightBorder);
    gap(doc, 10);
  });

  drawFooter(doc);

  doc.end();
  return new Promise(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));
}

function buildPdf(nt) {
  const items = getItems(nt);
  return items.length === 1 ? buildPdfSingleItem(items[0]) : buildPdfMulti(nt);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC API  (same surface as original)
// ─────────────────────────────────────────────────────────────────────────────
function createDownloadMeta(format, opts = {}) {
  const stamp = timestampForFilename();
  const slug  = opts.consignment ? sanitizeFilenamePart(opts.consignment) : null;
  const base  = slug ? `tracking-${slug}` : "tracking-report";
  if (format === "pdf")  return { contentType: "application/pdf", filename: `${base}-${stamp}.pdf` };
  if (format === "xlsx") return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${base}-${stamp}.xlsx`,
  };
  return { contentType: "text/csv; charset=utf-8", filename: `${base}-${stamp}.csv` };
}

async function buildReportBuffer(format, nt) {
  if (format === "csv")  return buildCsv(nt);
  if (format === "xlsx") return buildMasterXlsxBuffer(nt);
  return buildPdf(nt);   // "pdf"
}

module.exports = {
  createDownloadMeta,
  buildReportBuffer,
  buildUploadTemplateBuffer,
  buildMasterXlsxBuffer,
};
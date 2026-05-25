"use strict";

// ─────────────────────────────────────────────────────────────
// EXACT INDIA POST STYLE
// ─────────────────────────────────────────────────────────────

const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

let loadPdfLogos;
try {
  ({ loadPdfLogos } = require("./pdfLogos"));
} catch {
  loadPdfLogos = async () => ({});
}

let getConsignmentCategory;
try {
  ({ getConsignmentCategory } = require("./consignmentCategory"));
} catch {
  getConsignmentCategory = () => "Unknown";
}

let SHEET_CONSIGNMENTS;
let SHEET_ALL_EVENTS;
let SHEET_EXPORT_INFO;
let UPLOAD_COLUMN_CONSIGNMENT;
let EXAMPLE_CONSIGNMENT;
try {
  ({
    SHEET_CONSIGNMENTS,
    SHEET_ALL_EVENTS,
    SHEET_EXPORT_INFO,
    UPLOAD_COLUMN_CONSIGNMENT,
    EXAMPLE_CONSIGNMENT,
  } = require("./reportFormats"));
} catch {
  SHEET_CONSIGNMENTS = "Consignments";
  SHEET_ALL_EVENTS = "All_Events";
  SHEET_EXPORT_INFO = "_Export_Info";
  UPLOAD_COLUMN_CONSIGNMENT = "consignment";
  EXAMPLE_CONSIGNMENT = "QM125388411IN";
}
const PAGE_W = 595.28;
const PAGE_H = 841.89;

const ML = 34;
const MR = 34;
const MT = 24;
const MB = 24;

const IW = PAGE_W - ML - MR;
const ROW_H = 22;
const FOOTER_RESERVE = 30;
const CONTENT_BOTTOM = PAGE_H - MB - FOOTER_RESERVE;
const ITEM_BLOCK_MIN = 330;

const C = {
  border: "#d8d8d8",
  text: "#111111",
  muted: "#6b6b6b",
  red: "#c62828",
  blueBg: "#d8edf7",
  blueText: "#004d73",
  tblHeader: "#f3f3f3",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

const safeS = (v) => (v == null ? "" : String(v));

function getItems(nt) {
  return nt && Array.isArray(nt.items) ? nt.items : [];
}

function timestampForFilename(d = new Date()) {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

function sanitizeFilenamePart(s) {
  const u = safeS(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return u.slice(0, 40) || "report";
}

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);

  return `${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

function fmtDateTime(v) {
  if (!v) return "";

  const d = new Date(v);

  return `${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}:${pad2(d.getSeconds())}`;
}

function line(doc) {
  doc
    .strokeColor(C.border)
    .lineWidth(0.5)
    .moveTo(ML, doc.y)
    .lineTo(PAGE_W - MR, doc.y)
    .stroke();

  doc.y += 4;
}

function pngScaledWidth(buf, targetHeight) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf.toString("ascii", 1, 4) !== "PNG") return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (!w || !h) return null;
  return (targetHeight / h) * w;
}

function resetCursor(doc, y) {
  doc.x = ML;
  doc.y = y;
}

function addContentPage(doc) {
  doc.addPage();
  resetCursor(doc, MT);
}

function needsPage(doc, height) {
  return doc.y + height > CONTENT_BOTTOM;
}

function drawHeader(doc, logos = {}) {
  const y = MT;

  if (logos.ashok) {
    doc.image(logos.ashok, ML, y, {
      height: 52,
    });
  }

  const indiaPostH = 34;
  const indiaPostX = ML + 58;
  const indiaPostW =
    pngScaledWidth(logos.indiaPost, indiaPostH) ??
    indiaPostH * (2620 / 1698);
  const textX = indiaPostX + indiaPostW + 8;

  if (logos.indiaPost) {
    doc.image(logos.indiaPost, indiaPostX, y + 6, {
      height: indiaPostH,
    });
  }

  doc
    .fillColor(C.red)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("Department of Posts", textX, y + 2, {
      lineBreak: false,
    });

  doc
    .fillColor("#000")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Government of India", textX, y + 18, {
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .text("Ministry of Communications", textX, y + 32, {
      lineBreak: false,
    });

  resetCursor(doc, y + 56);
  line(doc);
}

function drawGenerated(doc) {
  const d = new Date();

  const stamp =
    `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}, ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
      d.getSeconds()
    )}`;

  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(7.2)
    .text(
      `Generated through Indiapost website on: ${stamp}`,
      ML,
      doc.y
    );

  doc.y += 12;
}

function drawTitle(doc) {
  doc
    .fillColor(C.text)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("Consignment/MO Tracking Report", ML, doc.y);

  doc.y += 10;
}

function drawConsignment(doc, cn) {
  const y = doc.y;

  doc
    .fillColor(C.text)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Consignment/MO Number:", ML, y + 5);

  const x = 190;

  doc
    .roundedRect(x, y, 140, 22, 3)
    .fill(C.blueBg);

  doc
    .fillColor(C.blueText)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(cn, x + 8, y + 6);

  doc.y = y + 32;
}

function cell(doc, x, y, w, h, label, value) {
  doc
    .rect(x, y, w, h)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor("#808080")
    .font("Helvetica")
    .fontSize(7)
    .text(label, x + 8, y + 6);

  doc
    .fillColor(C.text)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(value || "-", x + 8, y + 20, {
      width: w - 12,
      height: h - 26,
      ellipsis: true,
    });
}

function drawInfo(doc, bd, cons) {
  const x = ML;
  const y = doc.y;

  const W = IW / 2;

  cell(
    doc,
    x,
    y,
    W,
    42,
    "Article Number:",
    bd.article_number || cons
  );

  cell(
    doc,
    x + W,
    y,
    W,
    42,
    "Article Type:",
    bd.article_type || "-"
  );

  const row2 = y + 42;
  const col = IW / 3;

  cell(
    doc,
    x,
    row2,
    col,
    42,
    "Booked At:",
    bd.booked_at || "-"
  );

  cell(
    doc,
    x + col,
    row2,
    col,
    42,
    "Booked On:",
    fmtDate(bd.booked_on)
  );

  cell(
    doc,
    x + col * 2,
    row2,
    col,
    42,
    "Destination:",
    bd.delivery_location || "-"
  );

  const row3 = row2 + 42;

  cell(
    doc,
    x,
    row3,
    col,
    42,
    "Origin Pincode:",
    bd.origin_pincode || "-"
  );

  cell(
    doc,
    x + col,
    row3,
    col,
    42,
    "Delivered On:",
    bd.delivery_confirmed_on
      ? fmtDateTime(bd.delivery_confirmed_on)
      : "-"
  );

  cell(
    doc,
    x + col * 2,
    row3,
    col,
    42,
    "Destination Pincode:",
    bd.destination_pincode || "-"
  );

  doc.y = row3 + 52;
}

function drawCount(doc, total) {
  doc
    .fillColor("#000")
    .font("Helvetica")
    .fontSize(9)
    .text(String(total), ML, doc.y);

  doc.y += 6;
}

const widths = [160, 90, 70, 130, 77];

function drawTableHeader(doc) {
  const y = doc.y;

  doc
    .rect(ML, y, IW, 22)
    .fill(C.tblHeader);

  const headers = [
    "Event",
    "Date",
    "Time",
    "Office",
    "Remarks",
  ];

  let x = ML;

  headers.forEach((h, i) => {
    doc
      .fillColor("#111")
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(h, x + 5, y + 7);

    x += widths[i];
  });

  doc
    .rect(ML, y, IW, 22)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke();

  doc.y = y + 22;
}

function drawRow(doc, ev) {
  const y = doc.y;

  const vals = [
    ev.event || "-",
    fmtDate(ev.date),
    ev.time || "-",
    ev.office || "-",
    ev.remarks || "—",
  ];

  let x = ML;

  vals.forEach((v, i) => {
    doc
      .rect(x, y, widths[i], 22)
      .strokeColor(C.border)
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor("#111")
      .font("Helvetica")
      .fontSize(8)
      .text(v, x + 4, y + 7, {
        width: widths[i] - 8,
        ellipsis: true,
      });

    x += widths[i];
  });

  doc.y = y + 22;
}

function footer(doc) {
  const range = doc.bufferedPageRange();
  const end = range.start + range.count;

  for (let i = range.start; i < end; i++) {
    doc.switchToPage(i);

    doc
      .fillColor("#777")
      .font("Helvetica")
      .fontSize(7)
      .text(
        "https://www.indiapost.gov.in",
        ML,
        PAGE_H - 18
      );

    doc
      .text(
        `${i + 1}/${range.count}`,
        0,
        PAGE_H - 18,
        {
          width: PAGE_W - MR,
          align: "right",
        }
      );
  }
}

function renderItemReport(doc, item) {
  const bd = item.booking_details || {};
  const cons = item.consignment || bd.article_number || "-";
  const evs = Array.isArray(item.tracking_details)
    ? item.tracking_details
    : [];

  if (needsPage(doc, ITEM_BLOCK_MIN)) {
    addContentPage(doc);
  }

  drawTitle(doc);
  drawConsignment(doc, cons);
  drawInfo(doc, bd, cons);
  drawCount(doc, evs.length);
  drawTableHeader(doc);

  evs.forEach((ev) => {
    if (needsPage(doc, ROW_H)) {
      addContentPage(doc);
      drawTableHeader(doc);
    }
    drawRow(doc, ev);
  });

  doc.y += 12;
}

function newPdfDoc() {
  return new PDFDocument({
    size: "A4",
    margins: { left: ML, right: MR, top: MT, bottom: MB },
    bufferPages: true,
  });
}

function pdfToBuffer(doc) {
  return new Promise((resolve) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function buildPdfSingleItem(item, logos = {}) {
  const doc = newPdfDoc();
  const done = pdfToBuffer(doc);

  drawHeader(doc, logos);
  drawGenerated(doc);
  renderItemReport(doc, item);
  footer(doc);
  doc.end();

  return done;
}

async function buildPdfMulti(nt, logos = {}) {
  const items = getItems(nt);
  const doc = newPdfDoc();
  const done = pdfToBuffer(doc);

  drawHeader(doc, logos);
  drawGenerated(doc);

  doc
    .fillColor(C.text)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("Consignment/MO Tracking Report", ML, doc.y);
  doc.y += 8;
  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(9)
    .text(`Bulk tracking summary · ${items.length} consignment(s)`, ML, doc.y);
  doc.y += 14;

  items.forEach((item, idx) => {
    if (idx > 0) {
      if (needsPage(doc, ITEM_BLOCK_MIN)) {
        addContentPage(doc);
      }
      line(doc);
    }
    renderItemReport(doc, item);
  });

  footer(doc);
  doc.end();

  return done;
}

async function buildPdf(nt) {
  const items = getItems(nt);
  if (!items.length) {
    throw new Error("No tracking items found");
  }

  const logos = await loadPdfLogos();
  if (items.length === 1) {
    return buildPdfSingleItem(items[0], logos);
  }
  return buildPdfMulti(nt, logos);
}

function formatDateIsoSafe(d) {
  if (!d) return "";
  try {
    const x = new Date(String(d));
    return isNaN(x.getTime()) ? safeS(d) : x.toISOString();
  } catch {
    return safeS(d);
  }
}

function formatDateDisplay(d) {
  if (!formatDateIsoSafe(d)) return "";
  try {
    return new Date(String(d)).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return safeS(d);
  }
}

function buildSummaryRows(items) {
  return items.map((it, idx) => {
    const bd = it.booking_details || {};
    const cat = getConsignmentCategory(it.status);
    const le = it.last_event || {};
    const cons = safeS(it.consignment || bd.article_number);

    return {
      Row: idx + 1,
      Category: cat,
      Consignment: cons,
      Status: safeS(it.status),
      Article_Type: safeS(bd.article_type),
      Booked_At: safeS(bd.booked_at),
      Booked_On_ISO: formatDateIsoSafe(bd.booked_on),
      Booked_On_Display: formatDateDisplay(bd.booked_on),
      Origin_PIN: safeS(bd.origin_pincode),
      Dest_PIN: safeS(bd.destination_pincode),
      Delivery_Location: safeS(bd.delivery_location),
      Tariff: bd.tariff != null && bd.tariff !== "" ? bd.tariff : "",
      Delivery_Confirmed_ISO: formatDateIsoSafe(bd.delivery_confirmed_on),
      Delivery_Confirmed_Display: formatDateDisplay(
        bd.delivery_confirmed_on
      ),
      Last_Event: safeS(le.event),
      Last_Event_ISO: formatDateIsoSafe(le.date),
      Last_Event_Time: safeS(le.time),
      Last_Office: safeS(le.office),
      Tracking_Event_Count: Array.isArray(it.tracking_details)
        ? it.tracking_details.length
        : 0,
    };
  });
}

function buildEventRows(items) {
  const out = [];
  for (const it of items) {
    const cat = getConsignmentCategory(it.status);
    const cons = safeS(
      it.consignment ||
        (it.booking_details && it.booking_details.article_number)
    );
    (Array.isArray(it.tracking_details) ? it.tracking_details : []).forEach(
      (e, i) => {
        out.push({
          Consignment: cons,
          Category: cat,
          Status: safeS(it.status),
          Line: i + 1,
          Event_Date_ISO: formatDateIsoSafe(e.date),
          Event_Time: safeS(e.time),
          Office_ID: e.officeid != null ? e.officeid : "",
          Office: safeS(e.office),
          Event: safeS(e.event),
          Remarks: safeS(e.remarks),
        });
      }
    );
  }
  return out;
}

function buildMasterXlsxBuffer(nt) {
  const items = getItems(nt);
  const wb = XLSX.utils.book_new();
  const summary = buildSummaryRows(items);
  const events = buildEventRows(items);

  const ws1 = XLSX.utils.json_to_sheet(
    summary.length ? summary : [{ Info: "No rows" }]
  );
  ws1["!cols"] = [5, 14, 16, 14, 12, 28, 24, 24, 10, 10, 22, 8, 28, 24, 36, 28, 12, 28, 10].map(
    (w) => ({ wch: w })
  );
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_CONSIGNMENTS);

  const ws2 = XLSX.utils.json_to_sheet(
    events.length ? events : [{ Info: "No events" }]
  );
  ws2["!cols"] = [16, 14, 14, 6, 28, 12, 10, 36, 40, 20].map((w) => ({
    wch: w,
  }));
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

function csvEscape(v) {
  const s = safeS(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(nt) {
  const rows = buildSummaryRows(getItems(nt));
  if (!rows.length) {
    return Buffer.from("Info\r\nNo rows\r\n", "utf8");
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return Buffer.from(lines.join("\r\n"), "utf8");
}

function buildUploadTemplateBuffer() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [UPLOAD_COLUMN_CONSIGNMENT],
    [EXAMPLE_CONSIGNMENT],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_CONSIGNMENTS);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

function createDownloadMeta(format, opts = {}) {
  const stamp = timestampForFilename();
  const slug = opts.consignment
    ? sanitizeFilenamePart(opts.consignment)
    : null;
  const base = slug ? `tracking-${slug}` : "tracking-report";

  if (format === "pdf") {
    return {
      contentType: "application/pdf",
      filename: `${base}-${stamp}.pdf`,
    };
  }
  if (format === "xlsx") {
    return {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${base}-${stamp}.xlsx`,
    };
  }
  return {
    contentType: "text/csv; charset=utf-8",
    filename: `${base}-${stamp}.csv`,
  };
}

async function buildReportBuffer(format, nt) {
  if (format === "csv") {
    return buildCsv(nt);
  }
  if (format === "xlsx") {
    return buildMasterXlsxBuffer(nt);
  }
  return buildPdf(nt);
}

module.exports = {
  createDownloadMeta,
  buildReportBuffer,
  buildUploadTemplateBuffer,
  buildMasterXlsxBuffer,
};
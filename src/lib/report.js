"use strict";

/**
 * reportBuilder.js
 *
 * India Post Official Style PDF/XLSX/CSV Report Builder
 */

const path = require("path");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const { loadPdfLogos } = require("./pdfLogos");
const { formatEventRemarksForDisplay } = require("./eventRemarks");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

let getConsignmentCategory, getShipmentDisplayLabelFromItem;
let SHEET_CONSIGNMENTS, SHEET_ALL_EVENTS, SHEET_EXPORT_INFO;
let PDF_FOOTER_NOTE, UPLOAD_COLUMN_CONSIGNMENT, EXAMPLE_CONSIGNMENT;

try {
  ({ getConsignmentCategory, getShipmentDisplayLabelFromItem } = require("./consignmentCategory"));
} catch {
  getConsignmentCategory = () => "Unknown";
  getShipmentDisplayLabelFromItem = (it) => (it && it.status) || "Transit";
}

try {
  ({
    SHEET_CONSIGNMENTS,
    SHEET_ALL_EVENTS,
    SHEET_EXPORT_INFO,
    PDF_FOOTER_NOTE,
    UPLOAD_COLUMN_CONSIGNMENT,
    EXAMPLE_CONSIGNMENT,
  } = require("./reportFormats"));
} catch {
  SHEET_CONSIGNMENTS = "Consignments";
  SHEET_ALL_EVENTS = "All Events";
  SHEET_EXPORT_INFO = "Export Info";
  PDF_FOOTER_NOTE =
    "Generated via India Post tracking. For official records visit indiapost.gov.in.";
  UPLOAD_COLUMN_CONSIGNMENT = "Consignment";
  EXAMPLE_CONSIGNMENT = "EX123456789IN";
}

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  headerRed: "#C62829",
  headerBorder: "#d7d7d7",

  darkText: "#1a1a1a",
  greyLabel: "#7f8c8d",

  lightBorder: "#d9d9d9",

  cnBoxBg: "#d9edf7",
  cnBoxText: "#0b4f71",

  tableHeaderBg: "#f3f3f3",
  tableRowAlt: "#fafafa",
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const MARGIN = {
  left: 36,
  right: 36,
  top: 28,
  bottom: 36,
};

const INNER_W = PAGE_W - MARGIN.left - MARGIN.right;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, "0");
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function gap(doc, pts) {
  doc.y += pts;
}

function ensureSpace(doc, need = 80) {
  if (doc.y + need > PAGE_H - MARGIN.bottom) {
    doc.addPage();
    doc.y = MARGIN.top;
  }
}

function hRule(doc, color = "#ccc", thickness = 0.5) {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(thickness)
    .moveTo(MARGIN.left, doc.y)
    .lineTo(PAGE_W - MARGIN.right, doc.y)
    .stroke()
    .restore();

  doc.y += 1;
}

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
  } catch {
    return safeStr(d);
  }
}

function timestampForFilename(d = new Date()) {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

function sanitizeFilenamePart(s) {
  const u = safeStr(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return u.slice(0, 40) || "report";
}

function getItems(nt) {
  return nt && Array.isArray(nt.items) ? nt.items : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL HEADER
// ─────────────────────────────────────────────────────────────────────────────

function drawOfficialHeader(doc, logos = {}) {
  const x = MARGIN.left;
  const y = MARGIN.top;

  let textStartX = x;

  // National emblem (SVG → PNG via pdfLogos)
  if (logos.ashok) {
    doc.image(logos.ashok, x, y, { height: 56 });
    textStartX = x + 48;
  }

  // India Post wordmark
  if (logos.indiaPost) {
    const ipX = logos.ashok ? x + 50 : x;
    doc.image(logos.indiaPost, ipX, y + 6, { height: 42 });
    textStartX = ipX + 168;
  } else if (logos.ashok) {
    textStartX = x + 58;
  }

  const txtX = Math.max(textStartX, x + 200);

  doc
    .fillColor("#C62829")
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Department of Posts", txtX, y + 4);

  doc
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Government of India", txtX, y + 22);

  doc
    .fillColor("#000000")
    .font("Helvetica")
    .fontSize(8.5)
    .text("Ministry of Communications", txtX, y + 38);

  doc.y = y + 64;

  hRule(doc, C.headerBorder, 0.8);

  gap(doc, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATED STAMP
// ─────────────────────────────────────────────────────────────────────────────

function drawGeneratedStamp(doc) {
  const now = new Date();

  const stamp =
    `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}, ` +
    `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(
      now.getSeconds()
    )}`;

  doc
    .fillColor(C.greyLabel)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      `Generated through Indiapost website on: ${stamp}`,
      MARGIN.left,
      doc.y
    );

  gap(doc, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// TITLE
// ─────────────────────────────────────────────────────────────────────────────

function drawReportTitle(doc) {
  doc
    .fillColor(C.darkText)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("Consignment/MO Tracking Report", MARGIN.left, doc.y);

  gap(doc, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSIGNMENT NUMBER BOX
// ─────────────────────────────────────────────────────────────────────────────

function drawConsignmentNumber(doc, cn) {
  const x = MARGIN.left;
  const y = doc.y;

  doc
    .fillColor(C.darkText)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Consignment/MO Number:", x, y + 5);

  const boxX = x + 170;

  doc
    .roundedRect(boxX, y, 220, 24, 4)
    .fill(C.cnBoxBg);

  doc
    .fillColor(C.cnBoxText)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(safeStr(cn), boxX + 10, y + 6);

  doc.y = y + 34;
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO GRID
// ─────────────────────────────────────────────────────────────────────────────

function drawInfoGrid(doc, bd, cons) {
  const rows = [
    [
      ["Article Number", safeStr(bd.article_number) || cons],
      ["Article Type", safeStr(bd.article_type)],
      ["Tariff", bd.tariff ? `₹${bd.tariff}` : "₹0"],
    ],
    [
      ["Booked At", safeStr(bd.booked_at)],
      ["Booked On", fmtOfficialDate(bd.booked_on)],
      ["Destination", safeStr(bd.delivery_location)],
    ],
    [
      ["Origin Pincode", safeStr(bd.origin_pincode)],
      [
        "Delivered On",
        bd.delivery_confirmed_on
          ? fmtOfficialDate(bd.delivery_confirmed_on)
          : "",
      ],
      ["", ""],
    ],
  ];

  const colW = INNER_W / 3;
  const rowH = 46;

  let y = doc.y;

  rows.forEach((row) => {
    doc
      .rect(MARGIN.left, y, INNER_W, rowH)
      .strokeColor(C.lightBorder)
      .lineWidth(0.5)
      .stroke();

    row.forEach(([label, value], i) => {
      const x = MARGIN.left + i * colW;

      if (i > 0) {
        doc
          .moveTo(x, y)
          .lineTo(x, y + rowH)
          .strokeColor(C.lightBorder)
          .lineWidth(0.5)
          .stroke();
      }

      doc
        .fillColor(C.greyLabel)
        .font("Helvetica")
        .fontSize(8)
        .text(label, x + 8, y + 8);

      doc
        .fillColor(C.darkText)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(value || "—", x + 8, y + 22, {
          width: colW - 16,
        });
    });

    y += rowH;
  });

  doc.y = y + 12;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT TABLE
// ─────────────────────────────────────────────────────────────────────────────

const EV_COLS = [
  { label: "Event", w: 0.28 },
  { label: "Date", w: 0.17 },
  { label: "Time", w: 0.12 },
  { label: "Office", w: 0.22 },
  { label: "Remarks", w: 0.21 },
];

function getColWidths() {
  return EV_COLS.map((c) => c.w * INNER_W);
}

function drawEventTableHeader(doc) {
  const widths = getColWidths();

  const y = doc.y;

  doc
    .rect(MARGIN.left, y, INNER_W, 24)
    .fill(C.tableHeaderBg);

  let x = MARGIN.left;

  EV_COLS.forEach((c, i) => {
    doc
      .fillColor(C.darkText)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(c.label, x + 6, y + 7);

    x += widths[i];
  });

  doc
    .rect(MARGIN.left, y, INNER_W, 24)
    .strokeColor(C.lightBorder)
    .lineWidth(0.5)
    .stroke();

  doc.y = y + 24;
}

function drawEventRow(doc, ev, alt) {
  const widths = getColWidths();

  const vals = [
    safeStr(ev.event),
    fmtOfficialDate(ev.date),
    safeStr(ev.time),
    safeStr(ev.office),
    formatEventRemarksForDisplay(ev),
  ];

  doc.font("Helvetica").fontSize(9);

  const rowH = Math.max(
    30,
    ...vals.map((v, i) => {
      const colW = Math.max(1, (widths[i] || 0) - 12);
      const h = doc.heightOfString(v || "—", { width: colW });
      return (Number.isFinite(h) ? h : 12) + 10;
    })
  );

  ensureSpace(doc, rowH + 10);

  const y = doc.y;

  if (alt) {
    doc.rect(MARGIN.left, y, INNER_W, rowH).fill(C.tableRowAlt);
  }

  let x = MARGIN.left;

  vals.forEach((v, i) => {
    doc
      .fillColor(C.darkText)
      .font("Helvetica")
      .fontSize(9)
      .text(v || "—", x + 6, y + 6, {
        width: widths[i] - 12,
      });

    x += widths[i];
  });

  doc
    .rect(MARGIN.left, y, INNER_W, rowH)
    .strokeColor(C.lightBorder)
    .lineWidth(0.5)
    .stroke();

  doc.y = y + rowH;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

function drawFooter(doc) {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(C.greyLabel)
      .text(
        "https://www.indiapost.gov.in",
        MARGIN.left,
        PAGE_H - 26,
        {
          width: INNER_W,
          align: "left",
        }
      );

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(C.greyLabel)
      .text(`${i + 1}/${range.count}`, MARGIN.left, PAGE_H - 26, {
        width: INNER_W,
        align: "right",
      });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF SINGLE
// ─────────────────────────────────────────────────────────────────────────────

async function buildPdfSingleItem(item) {
  const logos = await loadPdfLogos();

  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: MARGIN,
      bufferPages: true,
    });

    const chunks = [];

    doc.on("data", (c) => chunks.push(c));

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    const bd = item.booking_details || {};

    const cons = safeStr(item.consignment || bd.article_number);

    const evs = Array.isArray(item.tracking_details) ? item.tracking_details : [];

    drawOfficialHeader(doc, logos);

    drawGeneratedStamp(doc);

    drawReportTitle(doc);

    drawConsignmentNumber(doc, cons);

    drawInfoGrid(doc, bd, cons);

    gap(doc, 8);

    drawEventTableHeader(doc);

    evs.forEach((ev, i) => {
      drawEventRow(doc, ev, i % 2 === 1);
    });

    drawFooter(doc);

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// XLSX
// ─────────────────────────────────────────────────────────────────────────────

function buildMasterXlsxBuffer(nt) {
  const items = getItems(nt);

  const rows = items.map((it, idx) => ({
    Row: idx + 1,
    Consignment:
      safeStr(it.consignment || it?.booking_details?.article_number),
    Status: safeStr(it.status),
    Article_Type: safeStr(it?.booking_details?.article_type),
    Booked_At: safeStr(it?.booking_details?.booked_at),
    Destination: safeStr(it?.booking_details?.delivery_location),
  }));

  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, SHEET_CONSIGNMENTS);

  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
  });

  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────────────────────

function buildCsv(nt) {
  const rows = getItems(nt);

  let csv = "Consignment,Status\n";

  rows.forEach((r) => {
    csv += `${safeStr(r.consignment)},${safeStr(r.status)}\n`;
  });

  return Buffer.from(csv, "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PDF
// ─────────────────────────────────────────────────────────────────────────────

async function buildPdf(nt) {
  const items = getItems(nt);

  if (!items.length) {
    throw new Error("No tracking items found");
  }

  return buildPdfSingleItem(items[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

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

function buildUploadTemplateBuffer() {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    [UPLOAD_COLUMN_CONSIGNMENT],
    [EXAMPLE_CONSIGNMENT],
  ]);

  XLSX.utils.book_append_sheet(wb, ws, SHEET_CONSIGNMENTS);

  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
  });

  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

module.exports = {
  createDownloadMeta,
  buildReportBuffer,
  buildUploadTemplateBuffer,
  buildMasterXlsxBuffer,
};
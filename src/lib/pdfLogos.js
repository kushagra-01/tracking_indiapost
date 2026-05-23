/**
 * Rasterize PDF header SVGs (PDFKit does not embed SVG). Sources: src/assets or client/public.
 */
const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

const LOGO_FILES = {
  ashok: "ashok-thumb-logo.svg",
  indiaPost: "indiapostlogo.svg"
};

/** @type {{ ashok?: Buffer, indiaPost?: Buffer } | null} */
let cache = null;

function resolveLogoPath(filename) {
  const dirs = [
    path.join(__dirname, "../assets"),
    path.join(__dirname, "../../client/public")
  ];
  for (const dir of dirs) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return path.join(dirs[0], filename);
}

async function rasterizeSvg(filePath, { height, trim = false }) {
  if (!sharp) throw new Error("sharp is not installed");
  let pipe = sharp(filePath, { density: 200 });
  if (trim) pipe = pipe.trim();
  return pipe.resize({ height, fit: "inside" }).png().toBuffer();
}

/**
 * @returns {Promise<{ ashok?: Buffer, indiaPost?: Buffer }>}
 */
async function loadPdfLogos() {
  if (cache) return cache;

  if (!sharp) {
    console.warn("pdfLogos: sharp not available — PDF header will omit logos");
    cache = {};
    return cache;
  }

  const out = {};
  try {
    out.ashok = await rasterizeSvg(resolveLogoPath(LOGO_FILES.ashok), { height: 56 });
  } catch (e) {
    console.warn("pdfLogos: Ashok emblem failed:", e.message);
  }

  try {
    out.indiaPost = await rasterizeSvg(resolveLogoPath(LOGO_FILES.indiaPost), {
      height: 42,
      trim: true
    });
  } catch (e) {
    console.warn("pdfLogos: India Post logo failed:", e.message);
  }

  cache = out;
  return cache;
}

module.exports = { loadPdfLogos };

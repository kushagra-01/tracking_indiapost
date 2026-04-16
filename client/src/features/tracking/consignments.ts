const CONSIGNMENT_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/i;

export function normalizeConsignment(input: string) {
  return String(input || "").trim().toUpperCase();
}

export function isValidConsignment(input: string) {
  return CONSIGNMENT_RE.test(String(input || "").trim());
}

export function splitPastedConsignments(text: string) {
  const raw = String(text || "")
    .split(/[\s,;]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  const normalized = raw.map(normalizeConsignment);
  const uniq = Array.from(new Set(normalized));
  const valid = uniq.filter(isValidConsignment);
  const invalid = uniq.filter((c) => !isValidConsignment(c));
  return { all: uniq, valid, invalid };
}


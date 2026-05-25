/**
 * Convert { value, unit } settings to milliseconds.
 * @param {{ value?: number, unit?: string }} spec
 * @param {{ value: number, unit: "hour" | "day" }} fallback
 */
function durationToMs(spec, fallback) {
  const value = Number(spec?.value);
  const unit = spec?.unit === "day" ? "day" : spec?.unit === "hour" ? "hour" : fallback.unit;
  const n = Number.isFinite(value) && value > 0 ? value : fallback.value;
  const mult = unit === "day" ? 86_400_000 : 3_600_000;
  return Math.round(n * mult);
}

module.exports = { durationToMs };

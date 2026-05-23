import type { TrackingEvent } from "./types";

function eventSortKey(e: TrackingEvent): number {
  const raw = e.date != null ? String(e.date) : "";
  const t = e.time != null ? String(e.time) : "00:00:00";
  const d = raw ? new Date(raw).getTime() : NaN;
  const base = Number.isFinite(d) ? d : 0;
  const parts = t.split(":").map((x) => parseInt(x, 10) || 0);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return base + (h * 3600 + m * 60 + s);
}

export function sortTrackingEventsDesc(events: TrackingEvent[]): TrackingEvent[] {
  if (events.length < 2) return [...events];
  return [...events].sort((a, b) => eventSortKey(b) - eventSortKey(a));
}

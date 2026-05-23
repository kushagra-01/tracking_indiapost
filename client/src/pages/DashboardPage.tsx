import { useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableContainer,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import IosShareIcon from "@mui/icons-material/IosShare";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useNavigate } from "react-router-dom";

import { useTracking } from "../features/tracking/TrackingContext";
import type { TrackingItem } from "../features/tracking/types";
import {
  cancelFullExportJob,
  createFullExportJob,
  downloadFullExportJob,
  downloadReport,
  listFullExportJobs,
  type FullExportJobStatus,
  trackConsignments,
  trackConsignmentsWithProgress
} from "../features/tracking/api";
import { buildSharePageUrl, createFullExportShareLink } from "../features/tracking/shareApi";
import { getConsignmentCategory } from "../features/tracking/consignmentCategory";
import { furthestJourneyStage, isRtoOrReturn, journeyStagesWithState } from "../features/tracking/journeyRace";
import { TrackingReportDialogContent } from "../features/tracking/TrackingReportDialogContent";

function shortBookingDate(v: unknown): string {
  if (v == null || v === "") return "";
  const s = typeof v === "string" ? v : String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  }
  return s;
}

function categoryChipColor(cat: ReturnType<typeof getConsignmentCategory>): "success" | "warning" | "info" | "default" {
  if (cat === "Delivered") return "success";
  if (cat === "RTO_Return") return "warning";
  if (cat === "In_Transit") return "info";
  return "default";
}

function ShipmentRaceCell({ it }: { it: TrackingItem }) {
  const bd = it.booking_details || {};
  const stages = journeyStagesWithState(it);
  const maxIdx = furthestJourneyStage(it);
  const rto = isRtoOrReturn(it);
  const cat = getConsignmentCategory(it.status);
  const dest =
    String(bd.delivery_location || "").trim() ||
    (bd.destination_pincode != null && bd.destination_pincode !== "" ? `PIN ${bd.destination_pincode}` : "");
  const originPin = bd.origin_pincode != null && bd.origin_pincode !== "" ? String(bd.origin_pincode) : "";

  const bits: string[] = [];
  if (bd.article_type) bits.push(`📦 ${bd.article_type}`);
  if (bd.tariff != null && bd.tariff !== "") bits.push(`₹${bd.tariff}`);
  if (dest) bits.push(`📍 ${dest}`);
  if (originPin || bd.destination_pincode) {
    const op = originPin || "—";
    const dp = bd.destination_pincode != null && bd.destination_pincode !== "" ? String(bd.destination_pincode) : "—";
    bits.push(`📮 ${op} → ${dp}`);
  }
  if (bd.booked_at) bits.push(`🏤 ${bd.booked_at}`);
  if (bd.booked_on) bits.push(`📅 ${shortBookingDate(bd.booked_on)}`);
  if (bd.delivery_confirmed_on) bits.push(`✅ ${shortBookingDate(bd.delivery_confirmed_on)}`);

  const lastEv = it.last_event;
  const lastLine =
    lastEv && (lastEv.event || lastEv.office || lastEv.date)
      ? `🕐 ${lastEv.date ? shortBookingDate(lastEv.date) : "—"}${lastEv.time ? ` · ${lastEv.time}` : ""} · ${String(lastEv.office || "").slice(0, 28)}${String(lastEv.office || "").length > 28 ? "…" : ""} · ${String(lastEv.event || "—").slice(0, 42)}${String(lastEv.event || "").length > 42 ? "…" : ""}`
      : "";

  return (
    <Stack spacing={0.35} sx={{ py: 0.15, maxWidth: 900 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0.75,
          columnGap: 1,
          rowGap: 0.35
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
          <Typography
            component="span"
            variant="body2"
            sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontWeight: 800, letterSpacing: 0.2, fontSize: "0.8rem" }}
          >
            {it.consignment || bd.article_number || "—"}
          </Typography>
          <Chip size="small" label={it.status || "Unknown"} color={categoryChipColor(cat)} variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
          {rto ? (
            <Chip size="small" label="↩ RTO" color="warning" sx={{ height: 20, fontSize: "0.6rem" }} />
          ) : null}
        </Box>

        <Box
          component="div"
          role="group"
          aria-label="Journey stages"
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            gap: 0.15,
            flex: "1 1 200px",
            minWidth: 0,
            minHeight: 18,
            overflowX: "auto",
            overflowY: "hidden",
            py: 0,
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { height: 3 }
          }}
        >
          {stages.map((stage, i) => (
            <Box key={stage.key} sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {i > 0 ? (
                <Box
                  sx={{
                    width: 8,
                    height: 2,
                    mx: 0.2,
                    borderRadius: 1,
                    flexShrink: 0,
                    bgcolor: maxIdx >= i ? "success.main" : "action.selected",
                    opacity: maxIdx >= i ? 0.95 : 0.35
                  }}
                />
              ) : null}
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.2,
                  px: 0.35,
                  py: 0,
                  borderRadius: 0.5,
                  fontSize: "0.58rem",
                  fontWeight: stage.current ? 800 : 600,
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  color: stage.done ? "success.dark" : "text.disabled",
                  bgcolor: stage.done ? "success.light" : "action.hover",
                  border: "1px solid",
                  borderColor: stage.current ? "primary.main" : stage.done ? "success.main" : "divider",
                  boxShadow: stage.current ? "0 0 0 1px rgba(25,118,210,0.2)" : "none"
                }}
              >
                <span aria-hidden>{stage.done ? "✓" : stage.emoji}</span>
                <span>{stage.shortLabel}</span>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {bits.length ? (
        <Typography variant="caption" sx={{ display: "block", fontSize: "0.65rem", lineHeight: 1.35, opacity: 0.88 }}>
          {bits.join(" · ")}
        </Typography>
      ) : null}
      {lastLine ? (
        <Typography variant="caption" sx={{ display: "block", fontSize: "0.62rem", lineHeight: 1.3, opacity: 0.75 }}>
          {lastLine}
        </Typography>
      ) : null}
    </Stack>
  );
}

export function DashboardPage() {
  const nav = useNavigate();
  const { consignments, tracking, trackJob, setTracking, clearTrackJob } = useTracking();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "delivered" | "rto" | "intransit" | "unknown">("all");
  const [busy, setBusy] = useState(false);
  const [trackLoad, setTrackLoad] = useState<{ showPercent: boolean; percent: number; detail: string } | null>(
    null
  );
  const [err, setErr] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<TrackingItem | null>(null);
  const [pdfFor, setPdfFor] = useState<string | null>(null);
  const [fullZipOpen, setFullZipOpen] = useState(false);
  const [exportJobs, setExportJobs] = useState<FullExportJobStatus[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareSnapshotLabel, setShareSnapshotLabel] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const items = tracking?.items ?? [];

  const zipConsignments = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
      const c = String(it.consignment || it.booking_details?.article_number || "")
        .trim()
        .toUpperCase();
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
    return out;
  }, [items]);

  const hasActiveExport = useMemo(
    () => exportJobs.some((j) => j.status === "queued" || j.status === "running"),
    [exportJobs]
  );

  useEffect(() => {
    if (!trackJob?.length) return;
    let cancelled = false;
    setErr(null);
    setTrackLoad({ showPercent: false, percent: 0, detail: "Contacting India Post…" });
    void (async () => {
      try {
        const data = await trackConsignmentsWithProgress(trackJob, (percent, showPercent, detail) => {
          if (!cancelled) setTrackLoad({ showPercent, percent, detail });
        });
        if (!cancelled) setTracking(data);
      } catch (e: unknown) {
        if (!cancelled) {
          const ax = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
          setErr(ax?.response?.data?.error?.message || ax?.message || "Tracking failed");
        }
      } finally {
        if (!cancelled) {
          clearTrackJob();
          setTrackLoad(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackJob, setTracking, clearTrackJob]);

  useEffect(() => {
    if (!tracking) return;
    const shouldPoll = fullZipOpen || hasActiveExport;
    if (!shouldPoll) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { items: rows } = await listFullExportJobs();
        if (!cancelled) setExportJobs(rows);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tracking, fullZipOpen, hasActiveExport]);

  const stats = useMemo(() => {
    const s = { all: items.length, delivered: 0, rto: 0, intransit: 0, unknown: 0 };
    for (const it of items) {
      const cat = getConsignmentCategory(it.status);
      if (cat === "Delivered") s.delivered += 1;
      else if (cat === "RTO_Return") s.rto += 1;
      else if (cat === "Unknown") s.unknown += 1;
      else s.intransit += 1;
    }
    return s;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return items.filter((it) => {
      const cat = getConsignmentCategory(it.status);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "delivered"
            ? cat === "Delivered"
            : filter === "rto"
              ? cat === "RTO_Return"
              : filter === "unknown"
                ? cat === "Unknown"
                : cat === "In_Transit";
      const c = String(it.consignment || "").toUpperCase();
      const matchesQ = needle ? c.includes(needle) || String(it.last_event?.office || "").toUpperCase().includes(needle) : true;
      return matchesFilter && matchesQ;
    });
  }, [items, q, filter]);

  const currentConsignments = useMemo(() => {
    // derive from filtered rows to keep downloads consistent with current view
    const list = filtered.map((x) => String(x.consignment || "")).filter(Boolean);
    return Array.from(new Set(list));
  }, [filtered]);

  async function refresh() {
    setErr(null);
    if (!consignments.length) {
      setErr("No consignments found. Upload first.");
      return;
    }
    setBusy(true);
    try {
      const data = await trackConsignments(consignments);
      setTracking(data);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "pdf" | "xlsx" | "csv") {
    setErr(null);
    if (!currentConsignments.length) {
      setErr("Nothing to download for current filter.");
      return;
    }
    setBusy(true);
    try {
      const { buf, contentType, filename } = await downloadReport(currentConsignments, format);
      saveAs(new Blob([buf], { type: contentType }), filename);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function startFullExportJob() {
    if (!zipConsignments.length) return;
    setErr(null);
    try {
      await createFullExportJob(zipConsignments);
      const { items: rows } = await listFullExportJobs();
      setExportJobs(rows);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not start export job"
      );
    }
  }

  async function downloadExportJobFile(job: FullExportJobStatus) {
    if (!job.downloadReady) return;
    setErr(null);
    try {
      const blob = await downloadFullExportJob(job.id);
      const stamp = new Date(job.createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      saveAs(blob, `IndiaPost_Full_Report_${stamp}.zip`);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Download failed"
      );
    }
  }

  async function createShareLink() {
    if (!zipConsignments.length) return;
    setErr(null);
    setShareBusy(true);
    setShareCopied(false);
    try {
      const meta = await createFullExportShareLink(zipConsignments);
      setShareUrl(buildSharePageUrl(meta.token));
      setShareSnapshotLabel(meta.snapshotDateLabel);
      setShareOpen(true);
      const { items: rows } = await listFullExportJobs();
      setExportJobs(rows);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Could not create share link"
      );
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setErr("Could not copy link — select and copy manually.");
    }
  }

  async function cancelExportJob(job: FullExportJobStatus) {
    if (job.status !== "queued" && job.status !== "running") return;
    setErr(null);
    try {
      await cancelFullExportJob(job.id);
      const { items: rows } = await listFullExportJobs();
      setExportJobs(rows);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Cancel failed"
      );
    }
  }

  async function downloadSinglePdf(consignment: string) {
    const c = consignment.trim().toUpperCase();
    if (!c) return;
    setErr(null);
    setPdfFor(c);
    try {
      const { buf, contentType, filename } = await downloadReport([c], "pdf");
      saveAs(new Blob([buf], { type: contentType }), filename);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || "PDF download failed");
    } finally {
      setPdfFor(null);
    }
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
          Tracking Dashboard
        </Typography>
        <Typography sx={{ opacity: 0.75, mt: 0.5 }}>
          Upload consignments, view tracking status, and download reports (PDF/XLSX/CSV).
        </Typography>
      </Box>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {trackLoad ? (
        <Card elevation={0}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography sx={{ fontWeight: 800 }}>Fetching tracking</Typography>
              {trackLoad.showPercent ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={trackLoad.percent}
                    sx={{ height: 10, borderRadius: 2 }}
                  />
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {trackLoad.percent}%
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.75 }}>
                      {trackLoad.detail}
                    </Typography>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  {trackLoad.detail}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {!tracking && !trackLoad ? (
        <Card elevation={0}>
          <CardContent>
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 800 }}>No tracking data yet</Typography>
              <Typography sx={{ opacity: 0.75 }}>
                Go to <b>Upload Consignments</b> to add consignments via Excel or paste.
              </Typography>
              <Box>
                <Button startIcon={<UploadFileIcon />} variant="contained" onClick={() => nav("/upload")}>
                  Upload consignments
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : tracking ? (
        <>
          <Card elevation={0}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ alignItems: { md: "center" } }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>Overview</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                      Upstream: {tracking.upstream_message || "—"}
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<RefreshIcon />}
                    variant="outlined"
                    disabled={busy}
                    onClick={() => void refresh()}
                  >
                    Refresh
                  </Button>
                  <Button
                    startIcon={<DownloadIcon />}
                    variant="contained"
                    disabled={busy}
                    onClick={() => void download("pdf")}
                  >
                    Download PDF
                  </Button>
                  <Button disabled={busy} onClick={() => void download("xlsx")}>
                    XLSX
                  </Button>
                  <Button disabled={busy} onClick={() => void download("csv")}>
                    CSV
                  </Button>
                  <Button
                    startIcon={<FolderZipIcon />}
                    color="secondary"
                    variant="outlined"
                    disabled={busy || !items.length}
                    onClick={() => {
                      setErr(null);
                      setFullZipOpen(true);
                      void listFullExportJobs().then(({ items: rows }) => setExportJobs(rows));
                    }}
                  >
                    Full report (ZIP)
                  </Button>
                  <Button
                    startIcon={<IosShareIcon />}
                    variant="outlined"
                    disabled={busy || shareBusy || !zipConsignments.length}
                    onClick={() => void createShareLink()}
                  >
                    {shareBusy ? "Creating link…" : "Share download link"}
                  </Button>
                </Stack>

                <Divider />

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Chip
                    label={`All: ${stats.all}`}
                    color={filter === "all" ? "primary" : "default"}
                    onClick={() => setFilter("all")}
                  />
                  <Chip
                    label={`Delivered: ${stats.delivered}`}
                    color={filter === "delivered" ? "success" : "default"}
                    onClick={() => setFilter("delivered")}
                  />
                  <Chip
                    label={`RTO/Return: ${stats.rto}`}
                    color={filter === "rto" ? "warning" : "default"}
                    onClick={() => setFilter("rto")}
                  />
                  <Chip
                    label={`In-transit: ${stats.intransit}`}
                    color={filter === "intransit" ? "info" : "default"}
                    onClick={() => setFilter("intransit")}
                  />
                  <Chip
                    label={`Unknown: ${stats.unknown}`}
                    color={filter === "unknown" ? "secondary" : "default"}
                    onClick={() => setFilter("unknown")}
                  />
                </Stack>

                <TextField
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search consignment / office…"
                  size="small"
                />
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  Showing <b>{filtered.length}</b> row(s). Quick exports respect the current filter.{" "}
                  <b>Full report (ZIP)</b> uses the <b>same server exports</b> as XLSX / single PDF: master Excel + PDFs in
                  <code> Delivered</code>, <code>RTO_Return</code>, <code>In_Transit</code>, <code>Unknown</code> — runs as
                  a <b>queued server job</b> (poll + download when ready).
                </Typography>
                {hasActiveExport ? (
                  <Alert severity="info" variant="outlined" sx={{ py: 0.75 }}>
                    Full ZIP export in progress — you can leave this page; open <b>Full report (ZIP)</b> again to view
                    status or start another job (queued after the current one).
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={0}>
            <CardContent>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 360 }}>Shipment — track strip + facts</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((it, idx) => (
                    <TableRow key={`${it.consignment || idx}`} hover>
                      <TableCell sx={{ verticalAlign: "top", borderBottom: "1px solid", borderColor: "divider" }}>
                        <ShipmentRaceCell it={it} />
                      </TableCell>
                      <TableCell align="right" sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                        <Tooltip title="Download single PDF (full timeline)">
                          <span>
                            <IconButton
                              size="small"
                              aria-label="Download PDF"
                              disabled={!it.consignment || pdfFor === it.consignment}
                              onClick={() => it.consignment && void downloadSinglePdf(it.consignment)}
                              sx={{ mr: 0.5 }}
                            >
                              <PictureAsPdfIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Button size="small" onClick={() => setOpenItem(it)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Dialog open={shareOpen} onClose={() => setShareOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IosShareIcon color="primary" /> Share full ZIP download
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Anyone with this link can open it <b>without logging in</b> — no username or password. The page
                  shows build <b>%</b>, then auto-downloads the same full report ZIP ({zipConsignments.length}{" "}
                  article{zipConsignments.length === 1 ? "" : "s"}).
                </Typography>
                {shareSnapshotLabel ? (
                  <Alert severity="warning" variant="outlined">
                    This link is generated on <b>{shareSnapshotLabel}</b>. Recipients will see tracking data{" "}
                    <b>for this date only</b> (snapshot at export time, not live updates later).
                  </Alert>
                ) : null}
                <Alert severity="info" variant="outlined">
                  Export starts immediately on the server. Recipients see live build progress, then automatic download
                  with transfer <b>%</b>. Links expire after the server retention window (~30 min).
                </Alert>
                <TextField
                  label="Share URL"
                  value={shareUrl ?? ""}
                  fullWidth
                  size="small"
                  slotProps={{ input: { readOnly: true } }}
                  onFocus={(e) => e.target.select()}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setShareOpen(false)}>Close</Button>
              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                disabled={!shareUrl}
                onClick={() => void copyShareLink()}
              >
                {shareCopied ? "Copied!" : "Copy link"}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={fullZipOpen} onClose={() => setFullZipOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FolderZipIcon color="secondary" /> Full report export (server job)
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  The server builds a <b>.zip</b> (master Excel + one PDF per article, throttled). Start a job, then{" "}
                  <b>Download</b> when status is ready — you can close this dialog or start another job (runs one at a time
                  on the server).
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, opacity: 0.9, "& li": { mb: 0.75 } }}>
                  <li>
                    <code>Excel/Master_Consignments.xlsx</code> — same as dashboard <b>XLSX</b>.
                  </li>
                  <li>
                    <code>PDF/&lt;Category&gt;/&lt;ARTICLE&gt;.pdf</code> — same as row <b>PDF</b>.
                  </li>
                  <li>
                    <code>README.txt</code> — counts and layout notes.
                  </li>
                </Box>
                <Alert severity="info" variant="outlined">
                  Status updates every few seconds while a job is <b>queued</b> or <b>running</b>. Large lists can take many
                  minutes; the browser is not blocked — only the export queue runs on the server.
                </Alert>
                <Typography sx={{ fontWeight: 700 }}>Recent jobs</Typography>
                {exportJobs.length ? (
                  <TableContainer sx={{ maxHeight: 280, border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Job</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">%</TableCell>
                          <TableCell>Detail</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {exportJobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}>
                              {job.id.slice(0, 8)}…
                              <Typography variant="caption" sx={{ display: "block", opacity: 0.7 }}>
                                {job.consignmentCount} articles
                                {job.fileSize != null && job.fileSize > 0
                                  ? ` · ${job.fileSize < 1024 ? `${job.fileSize} B` : `${(job.fileSize / 1024).toFixed(0)} KB`}`
                                  : ""}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={job.status}
                                color={
                                  job.status === "done"
                                    ? "success"
                                    : job.status === "failed"
                                      ? "error"
                                      : job.status === "cancelled"
                                        ? "default"
                                        : job.status === "running"
                                          ? "info"
                                          : "warning"
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">{job.percent}</TableCell>
                            <TableCell sx={{ maxWidth: 220, wordBreak: "break-word", fontSize: "0.8rem" }}>
                              {job.detail}
                              {job.error ? (
                                <Typography variant="caption" color="error" sx={{ display: "block" }}>
                                  {job.error}
                                </Typography>
                              ) : null}
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                              <Button
                                size="small"
                                disabled={!job.downloadReady}
                                onClick={() => void downloadExportJobFile(job)}
                              >
                                Download
                              </Button>
                              <Button
                                size="small"
                                disabled={job.status !== "queued" && job.status !== "running"}
                                onClick={() => void cancelExportJob(job)}
                              >
                                Cancel
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    No jobs yet — start an export below.
                  </Typography>
                )}
                {hasActiveExport ? (
                  <Stack spacing={1}>
                    <LinearProgress
                      sx={{ borderRadius: 1, height: 6 }}
                      variant="indeterminate"
                      color="secondary"
                    />
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      Processing on server…
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
              <Button onClick={() => setFullZipOpen(false)}>Close</Button>
              <Button
                variant="outlined"
                startIcon={<IosShareIcon />}
                disabled={shareBusy || !zipConsignments.length}
                onClick={() => void createShareLink()}
              >
                Share link
              </Button>
              <Button
                variant="contained"
                color="secondary"
                disabled={!zipConsignments.length}
                startIcon={<FolderZipIcon />}
                onClick={() => void startFullExportJob()}
              >
                Start new export
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={Boolean(openItem)}
            onClose={() => setOpenItem(null)}
            maxWidth="md"
            fullWidth
            scroll="paper"
            transitionDuration={280}
            slotProps={{
              paper: {
                elevation: 8,
                sx: {
                  borderRadius: 3,
                  overflow: "hidden",
                  backgroundImage: (t) =>
                    `linear-gradient(180deg, ${t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(25,118,210,0.06)"} 0%, transparent 48px)`
                }
              }
            }}
          >
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                flexWrap: "wrap",
                pb: 1.5,
                pt: 2.5,
                px: 2.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0,0,0,0.2)" : "grey.50")
              }}
            >
              <Stack spacing={0.25}>
                <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 1.2, fontSize: "0.65rem" }}>
                  India Post · live snapshot
                </Typography>
                <Typography variant="h6" component="span" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
                  Consignment lifecycle report
                </Typography>
              </Stack>
              {openItem?.consignment ? (
                <Chip
                  label={openItem.consignment}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontWeight: 700, borderWidth: 2 }}
                />
              ) : null}
            </DialogTitle>
            <DialogContent dividers sx={{ px: 0, py: 0, bgcolor: "background.default" }}>
              {openItem ? <TrackingReportDialogContent item={openItem} /> : null}
            </DialogContent>
            <DialogActions
              sx={{
                px: 2.5,
                py: 2,
                gap: 1,
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(0,0,0,0.15)" : "grey.50"),
                borderTop: "1px solid",
                borderColor: "divider"
              }}
            >
              <Button onClick={() => setOpenItem(null)} color="inherit">
                Close
              </Button>
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                disabled={!openItem?.consignment || pdfFor === openItem?.consignment}
                onClick={() => openItem?.consignment && void downloadSinglePdf(openItem.consignment)}
              >
                Download PDF
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : null}
    </Stack>
  );
}


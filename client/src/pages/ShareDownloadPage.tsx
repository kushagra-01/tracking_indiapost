import { useCallback, useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import { useParams } from "react-router-dom";

import {
  downloadShareExportZip,
  fetchShareExportStatus,
  shareZipFilename,
  type ShareExportStatus
} from "../features/tracking/shareApi";

type Phase = "loading" | "building" | "downloading" | "done" | "error";

export function ShareDownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<ShareExportStatus | null>(null);
  const [buildPct, setBuildPct] = useState(0);
  const [buildDetail, setBuildDetail] = useState("");
  const [dlPct, setDlPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const downloadStarted = useRef(false);

  const runDownload = useCallback(async (meta: ShareExportStatus) => {
    if (!token || downloadStarted.current) return;
    downloadStarted.current = true;
    setPhase("downloading");
    setDlPct(0);
    try {
      const blob = await downloadShareExportZip(token, (pct) => setDlPct(pct));
      saveAs(blob, shareZipFilename(meta.generatedAt));
      setDlPct(100);
      setPhase("done");
    } catch (e: unknown) {
      downloadStarted.current = false;
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Download failed";
      setErr(msg);
      setPhase("error");
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setErr("Invalid share link.");
      setPhase("error");
      return;
    }

    let cancelled = false;
    let pollId: number | undefined;

    const poll = async () => {
      try {
        const data = await fetchShareExportStatus(token);
        if (cancelled) return;
        setStatus(data);
        setBuildPct(data.job.percent);
        setBuildDetail(data.job.detail || data.job.status);

        if (data.job.status === "failed") {
          setErr(data.job.error || "Export failed on the server.");
          setPhase("error");
          if (pollId) window.clearInterval(pollId);
          return;
        }
        if (data.job.status === "cancelled") {
          setErr("This export was cancelled.");
          setPhase("error");
          if (pollId) window.clearInterval(pollId);
          return;
        }

        if (data.job.downloadReady) {
          if (pollId) window.clearInterval(pollId);
          void runDownload(data);
          return;
        }

        setPhase("building");
      } catch (e: unknown) {
        if (cancelled) return;
        const ax = e as { response?: { status?: number; data?: { error?: { message?: string } } } };
        const msg =
          ax?.response?.status === 404
            ? "This download link has expired or does not exist. Ask the sender to create a new share link from the dashboard."
            : ax?.response?.data?.error?.message ||
              (e && typeof e === "object" && "message" in e
                ? String((e as { message: string }).message)
                : "Could not load share link");
        setErr(msg);
        setPhase("error");
        if (pollId) window.clearInterval(pollId);
      }
    };

    void poll();
    pollId = window.setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
    };
  }, [token, runDownload]);

  const snapshotLabel = status?.snapshotDateLabel ?? "—";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        py: 4,
        background: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(160deg, #0d1117 0%, #1a237e 55%, #0d1117 100%)"
            : "linear-gradient(160deg, #e3f2fd 0%, #f5f5f5 45%, #fff8e1 100%)"
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={6} sx={{ borderRadius: 3, overflow: "hidden" }}>
          <Box
            sx={{
              px: 3,
              py: 2.5,
              background: (t) =>
                `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
              color: "primary.contrastText"
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <FolderZipIcon sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="overline" sx={{ opacity: 0.9, letterSpacing: 1.2 }}>
                  India Post · shared export
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  Full tracking report (ZIP)
                </Typography>
              </Box>
            </Stack>
          </Box>

          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              {status ? (
                <Alert severity="warning" variant="outlined" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
                  <Typography variant="body2" component="div">
                    This link was generated on <b>{snapshotLabel}</b>. The tracking data in this download
                    reflects India Post status <b>as of that date only</b> — not live updates after the link was
                    created.
                  </Typography>
                  {status.consignmentCount > 0 ? (
                    <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.85 }}>
                      {status.consignmentCount} consignment{status.consignmentCount === 1 ? "" : "s"} in this
                      archive.
                    </Typography>
                  ) : null}
                </Alert>
              ) : null}

              {err ? (
                <Alert severity="error">{err}</Alert>
              ) : (
                <>
                  {phase === "loading" || (phase === "building" && !status) ? (
                    <Stack spacing={2} sx={{ py: 3, alignItems: "center" }}>
                      <CircularProgress size={48} />
                      <Typography sx={{ opacity: 0.8 }}>Connecting to server…</Typography>
                    </Stack>
                  ) : null}

                  {phase === "building" && status ? (
                    <Stack spacing={1.5}>
                      <Typography sx={{ fontWeight: 700 }}>Preparing your ZIP on the server</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.75 }}>
                        Master Excel + PDFs per article (same as dashboard full export). No login required.
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={buildPct}
                        sx={{ height: 10, borderRadius: 2 }}
                        color="primary"
                      />
                      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {buildPct}%
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7, maxWidth: "70%", textAlign: "right" }}>
                          {buildDetail}
                        </Typography>
                      </Stack>
                    </Stack>
                  ) : null}

                  {phase === "downloading" ? (
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <CloudDownloadIcon color="primary" />
                        <Typography sx={{ fontWeight: 700 }}>Downloading ZIP to your device</Typography>
                      </Stack>
                      <LinearProgress
                        variant={dlPct == null ? "indeterminate" : "determinate"}
                        value={dlPct ?? 0}
                        sx={{ height: 10, borderRadius: 2 }}
                        color="secondary"
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {dlPct == null ? "Starting download…" : `${dlPct}%`}
                      </Typography>
                    </Stack>
                  ) : null}

                  {phase === "done" ? (
                    <Alert severity="success" icon={<CloudDownloadIcon />}>
                      Download complete. You can close this tab or download again from your browser history if
                      needed.
                    </Alert>
                  ) : null}
                </>
              )}

              <Typography variant="caption" sx={{ opacity: 0.55, textAlign: "center" }}>
                Secure shared link · no login required · expires after the period set by your administrator (typically 30 days)
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

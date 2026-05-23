import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import BoltIcon from "@mui/icons-material/Bolt";
import DownloadIcon from "@mui/icons-material/Download";
import { useNavigate } from "react-router-dom";

import { splitPastedConsignments } from "../features/tracking/consignments";
import { fetchUploadTemplate, uploadTemplateDownloadFilename } from "../features/tracking/api";
import { SHEET_CONSIGNMENTS, UPLOAD_COLUMN_CONSIGNMENT } from "../features/tracking/reportFormats";
import { useTracking } from "../features/tracking/TrackingContext";

export function UploadPage() {
  const nav = useNavigate();
  const { startTrackJob } = useTracking();
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileCons, setFileCons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);

  const pasted = useMemo(() => splitPastedConsignments(paste), [paste]);
  const allValid = useMemo(() => {
    const all = Array.from(new Set([...fileCons, ...pasted.valid]));
    return all;
  }, [fileCons, pasted.valid]);

  /** Same file as `GET /track/upload-template` — identical to server `buildUploadTemplateBuffer`. */
  async function downloadTemplate() {
    setError(null);
    setTemplateBusy(true);
    try {
      const blob = await fetchUploadTemplate();
      saveAs(blob, uploadTemplateDownloadFilename());
    } catch (e: unknown) {
      setError(e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Could not download template");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function onPickFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.includes(SHEET_CONSIGNMENTS) ? SHEET_CONSIGNMENTS : wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const col = UPLOAD_COLUMN_CONSIGNMENT;
      const cons = rows
        .map((r) => {
          const o = r as Record<string, unknown>;
          return String(o[col] ?? o.Consignment ?? o.CONSIGNMENT ?? "").trim();
        })
        .filter(Boolean);
      const parsed = splitPastedConsignments(cons.join("\n"));
      setFileCons(parsed.valid);
      if (parsed.invalid.length) {
        setError(`Excel has ${parsed.invalid.length} invalid consignment(s). Please fix them.`);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to read Excel");
      setFileCons([]);
    }
  }

  function runTracking() {
    setError(null);
    if (!allValid.length) {
      setError("Add at least 1 valid consignment.");
      return;
    }
    if (busy) return;
    setBusy(true);
    startTrackJob(allValid);
    nav("/", { replace: true });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
        Upload Consignments
      </Typography>

      <Card elevation={0}>
        <CardContent>
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 800 }}>Excel format (only this)</Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Use sheet <b>{SHEET_CONSIGNMENTS}</b> (or first sheet) with column header{" "}
              <b>{UPLOAD_COLUMN_CONSIGNMENT}</b> — same layout as the server template.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Chip label={`Sheet: ${SHEET_CONSIGNMENTS} (or first)`} />
              <Chip label={`Column: ${UPLOAD_COLUMN_CONSIGNMENT}`} />
            </Stack>
            <Box>
              <Button
                startIcon={<DownloadIcon />}
                disabled={templateBusy}
                onClick={() => void downloadTemplate()}
              >
                {templateBusy ? "Preparing…" : "Download Excel template"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={0}>
        <CardContent>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 800 }}>Upload Excel</Typography>
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                sx={{ width: "fit-content" }}
              >
                Choose `.xlsx`
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickFile(f);
                  }}
                />
              </Button>
              {fileName ? (
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  Selected: <b>{fileName}</b> ({fileCons.length} valid)
                </Typography>
              ) : null}
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 800 }}>Or paste consignments</Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Paste one per line (or comma/space separated). We’ll auto-dedupe and validate.
              </Typography>
              <TextField
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="QM125388411IN&#10;RR123456789IN"
                multiline
                minRows={6}
                fullWidth
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip label={`Valid: ${pasted.valid.length}`} color={pasted.valid.length ? "success" : "default"} />
                <Chip
                  label={`Invalid: ${pasted.invalid.length}`}
                  color={pasted.invalid.length ? "warning" : "default"}
                />
                <Chip label={`Unique total: ${pasted.all.length}`} />
              </Stack>
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ alignItems: { md: "center" } }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>Ready to track</Typography>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  Using <b>{allValid.length}</b> valid consignment(s).
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<BoltIcon />}
                disabled={busy}
                onClick={() => void runTracking()}
              >
                {busy ? "Starting…" : "Track now"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}


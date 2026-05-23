import { useMemo, type ReactNode } from "react";
import {
  alpha,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme
} from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
// import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";

import { displayLabelChipColor, getShipmentDisplayLabelFromItem } from "./consignmentCategory";
import { emojiForTrackingEvent } from "./eventEmoji";
import type { TrackingItem } from "./types";

function shortBookingDate(v: unknown): string {
  if (v == null || v === "") return "";
  const s = typeof v === "string" ? v : String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  return s;
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

type Props = { item: TrackingItem };

function SectionCard({
  icon,
  title,
  description,
  children,
  accent = "primary"
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  accent?: "primary" | "secondary";
}) {
  const theme = useTheme();
  const main = accent === "primary" ? theme.palette.primary.main : theme.palette.secondary.main;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        bgcolor: "background.paper",
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? `0 1px 0 ${alpha("#fff", 0.06)} inset, 0 8px 32px ${alpha("#000", 0.35)}`
            : `0 1px 0 ${alpha("#000", 0.04)} inset, 0 12px 40px ${alpha(main, 0.07)}`
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: (t) =>
            `linear-gradient(135deg, ${alpha(main, t.palette.mode === "dark" ? 0.14 : 0.09)} 0%, transparent 65%)`
        }}
      >
        <Box
          sx={{
            mt: 0.1,
            width: 36,
            height: 36,
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.contrastText",
            bgcolor: main,
            flexShrink: 0,
            boxShadow: `0 4px 14px ${alpha(main, 0.35)}`
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: -0.2, lineHeight: 1.25 }}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="caption" sx={{ display: "block", opacity: 0.72, mt: 0.35, lineHeight: 1.45 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}

export function TrackingReportDialogContent({ item }: Props) {
  const theme = useTheme();
  const bd = item.booking_details || {};
  const cons = String(item.consignment || bd.article_number || "—");
  // const stages = journeyStagesWithState(item);
  // const maxIdx = furthestJourneyStage(item);
  const statusLabel = getShipmentDisplayLabelFromItem(item);
  const events = Array.isArray(item.tracking_details) ? item.tracking_details : [];

  const consMo = useMemo(() => {
    const m = fmt(bd.mo_number);
    return m !== "—" ? m : cons;
  }, [bd, cons]);

  const particularsRows = useMemo(
    () => [
      { label: "Consignment / MO number", value: consMo },
      { label: "Article number", value: fmt(bd.article_number) !== "—" ? fmt(bd.article_number) : cons },
      { label: "Article type", value: fmt(bd.article_type) },
      { label: "Tariff", value: bd.tariff != null && bd.tariff !== "" ? `₹${fmt(bd.tariff)}` : "—" },
      { label: "Booked at (office / location)", value: fmt(bd.booked_at) },
      { label: "Booked on", value: bd.booked_on ? shortBookingDate(bd.booked_on) : "—" },
      { label: "Origin pincode", value: fmt(bd.origin_pincode) },
      { label: "Destination pincode", value: fmt(bd.destination_pincode) },
      { label: "Destination (delivery office / area)", value: fmt(bd.delivery_location) },
      { label: "Delivered on", value: bd.delivery_confirmed_on ? shortBookingDate(bd.delivery_confirmed_on) : "—" }
    ],
    [bd, cons, consMo]
  );

  const primary = theme.palette.primary.main;

  return (
    <Stack spacing={2.25} sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2.5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 2.25,
          borderRadius: 2.5,
          position: "relative",
          overflow: "hidden",
          border: "1px solid",
          borderColor: alpha(primary, 0.35),
          background: (t) =>
            `linear-gradient(125deg, ${alpha(primary, t.palette.mode === "dark" ? 0.22 : 0.12)} 0%, ${alpha(
              t.palette.secondary.main,
              0.06
            )} 42%, transparent 72%)`,
          boxShadow: (t) =>
            `0 0 0 1px ${alpha(primary, 0.08)} inset, 0 18px 48px ${alpha(primary, t.palette.mode === "dark" ? 0.12 : 0.1)}`
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            borderRadius: "0 4px 4px 0",
            background: `linear-gradient(180deg, ${primary}, ${theme.palette.secondary.main})`
          }}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, pl: 0.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 8px 24px ${alpha(primary, 0.4)}`
              }}
            >
              <LocalShippingIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1.4, fontSize: "0.65rem" }}>
                Tracking snapshot
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  fontFamily: "ui-monospace, Consolas, monospace",
                  letterSpacing: 0.4,
                  lineHeight: 1.15,
                  wordBreak: "break-all"
                }}
              >
                {cons}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center", justifyContent: { sm: "flex-end" }, flex: 1, gap: 1 }}>
            <Chip size="small" label={statusLabel} color={displayLabelChipColor(statusLabel)} sx={{ fontWeight: 700 }} />
          </Stack>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: 1.75,
          borderRadius: 2.5,
          borderColor: alpha(theme.palette.info.main, 0.45),
          bgcolor: (t) => alpha(t.palette.info.main, t.palette.mode === "dark" ? 0.1 : 0.05)
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <InfoOutlinedIcon sx={{ fontSize: 22, color: "info.main", mt: 0.15, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.6, fontSize: "0.8125rem", color: "text.primary" }}>
            Official consignment view: identifiers, tariff, booking and delivery fields, plus a chronological event log — aligned
            with India Post tracking and PDF exports.
          </Typography>
        </Stack>
      </Paper>

      {/* Journey milestones section disabled
      <SectionCard
        accent="primary"
        icon={<FlagOutlinedIcon sx={{ fontSize: 20 }} />}
        title="Journey milestones"
        description={JOURNEY_STAGES.map((s) => s.label).join(" → ")}
      >
        ...
      </SectionCard>
      */}

      <SectionCard
        accent="secondary"
        icon={<ArticleOutlinedIcon sx={{ fontSize: 20 }} />}
        title="Article particulars"
        description="Booking and delivery fields from the latest refresh."
      >
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderColor: "divider",
            overflow: "hidden",
            boxShadow: "none"
          }}
        >
          <Table size="small" sx={{ "& td": { py: 1.1, px: 1.5, borderColor: "divider" } }}>
            <TableBody>
              {particularsRows.map((row, idx) => (
                <TableRow
                  key={row.label}
                  sx={{
                    bgcolor: idx % 2 === 0 ? "action.hover" : "transparent",
                    "&:last-of-type td": { borderBottom: "none" }
                  }}
                >
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{
                      width: { xs: "44%", sm: "40%" },
                      maxWidth: 200,
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      verticalAlign: "top"
                    }}
                  >
                    {row.label}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      wordBreak: "break-word",
                      verticalAlign: "top"
                    }}
                  >
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard
        accent="primary"
        icon={<TimelineOutlinedIcon sx={{ fontSize: 20 }} />}
        title={`Event timeline (${events.length})`}
        description="Oldest → newest — date, time, office, and remarks."
      >
        {events.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: "action.hover",
              textAlign: "center",
              borderStyle: "dashed"
            }}
          >
            <ViewListOutlinedIcon sx={{ fontSize: 40, opacity: 0.35, mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              No tracking events returned for this article.
            </Typography>
          </Paper>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius: 2,
              maxHeight: { xs: 320, sm: 400 },
              overflow: "auto",
              borderColor: "divider",
              boxShadow: "none"
            }}
          >
            <Table size="small" stickyHeader sx={{ minWidth: 480, "& th": { fontWeight: 800, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.6 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 44, bgcolor: "background.paper" }}>#</TableCell>
                  <TableCell sx={{ width: 44, bgcolor: "background.paper" }} aria-label="Kind" />
                  <TableCell sx={{ bgcolor: "background.paper" }}>Date</TableCell>
                  <TableCell sx={{ width: 72, bgcolor: "background.paper" }}>Time</TableCell>
                  <TableCell sx={{ minWidth: 110, bgcolor: "background.paper" }}>Office</TableCell>
                  <TableCell sx={{ bgcolor: "background.paper" }}>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((e, i) => {
                  const isLast = i === events.length - 1;
                  return (
                    <TableRow
                      key={i}
                      hover
                      sx={{
                        transition: "background-color 0.15s ease",
                        "&:nth-of-type(even)": { bgcolor: alpha(theme.palette.action.hover, 0.65) },
                        ...(isLast
                          ? {
                              bgcolor: alpha(primary, theme.palette.mode === "dark" ? 0.12 : 0.06),
                              "&:hover": { bgcolor: alpha(primary, theme.palette.mode === "dark" ? 0.16 : 0.09) }
                            }
                          : {})
                      }}
                    >
                      <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.75rem" }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontSize: "1.05rem" }}>{emojiForTrackingEvent(e.event)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{e.date ? shortBookingDate(e.date) : "—"}</TableCell>
                      <TableCell sx={{ opacity: 0.9 }}>{e.time || "—"}</TableCell>
                      <TableCell sx={{ color: "primary.main", fontWeight: 700, fontSize: "0.8rem" }}>{e.office || "—"}</TableCell>
                      <TableCell sx={{ wordBreak: "break-word", fontWeight: 500 }}>{e.event || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </Stack>
  );
}

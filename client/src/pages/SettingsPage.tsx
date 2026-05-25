import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../features/auth/AuthContext";
import {
  fetchSettings,
  formatDuration,
  updateSettings,
  type AppSettings,
  type DurationUnit
} from "../api/settings";
import { Navigate } from "react-router-dom";

function canManageSettings(role: string | undefined) {
  return role === "superadmin" || role === "admin";
}

export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: fetchSettings, enabled: canManageSettings(user?.role) });

  const [consignmentCache, setConsignmentCache] = useState<{ value: string; unit: DurationUnit }>({
    value: "24",
    unit: "hour"
  });
  const [shareLinkExpiry, setShareLinkExpiry] = useState<{ value: string; unit: DurationUnit }>({
    value: "30",
    unit: "day"
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settingsQ.data || hydrated) return;
    setConsignmentCache({
      value: String(settingsQ.data.consignmentCache.value),
      unit: settingsQ.data.consignmentCache.unit
    });
    setShareLinkExpiry({
      value: String(settingsQ.data.shareLinkExpiry.value),
      unit: settingsQ.data.shareLinkExpiry.unit
    });
    setHydrated(true);
  }, [settingsQ.data, hydrated]);

  if (!canManageSettings(user?.role)) {
    return <Navigate to="/" replace />;
  }

  const saveM = useMutation({
    mutationFn: () =>
      updateSettings({
        consignmentCache: {
          value: Number.parseInt(consignmentCache.value, 10),
          unit: consignmentCache.unit
        },
        shareLinkExpiry: {
          value: Number.parseInt(shareLinkExpiry.value, 10),
          unit: shareLinkExpiry.unit
        }
      }),
    onSuccess: async (data: AppSettings) => {
      await qc.setQueryData(["settings"], data);
      setHydrated(true);
    }
  });

  const current = settingsQ.data;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
          App settings
        </Typography>
        <Typography sx={{ opacity: 0.75, mt: 0.5 }}>
          Control how long tracking data is reused and when shared download links expire.
        </Typography>
      </Box>

      {settingsQ.error ? (
        <Alert severity="error">
          {(settingsQ.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || "Could not load settings"}
        </Alert>
      ) : null}

      {saveM.error ? (
        <Alert severity="error">
          {(saveM.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
            ?.message || "Could not save settings"}
        </Alert>
      ) : null}

      {saveM.isSuccess ? (
        <Alert severity="success">Settings saved. New lookups and share links use these values immediately.</Alert>
      ) : null}

      <Card elevation={0}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Consignment history refresh</Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                If a consignment was searched within this window, the dashboard reuses stored tracking instead of
                calling India Post again.
                {current ? (
                  <>
                    {" "}
                    Current: <b>{formatDuration(current.consignmentCache)}</b>.
                  </>
                ) : null}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label="Value"
                  type="number"
                  size="small"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={consignmentCache.value}
                  onChange={(e) => setConsignmentCache((s) => ({ ...s, value: e.target.value }))}
                  sx={{ maxWidth: 140 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    label="Unit"
                    value={consignmentCache.unit}
                    onChange={(e) =>
                      setConsignmentCache((s) => ({ ...s, unit: e.target.value as DurationUnit }))
                    }
                  >
                    <MenuItem value="hour">Hours</MenuItem>
                    <MenuItem value="day">Days</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 800 }}>Share download link expiry</Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                Public ZIP links stop working after this period; admins must create a new link for recipients.
                {current ? (
                  <>
                    {" "}
                    Current: <b>{formatDuration(current.shareLinkExpiry)}</b>.
                  </>
                ) : null}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label="Value"
                  type="number"
                  size="small"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={shareLinkExpiry.value}
                  onChange={(e) => setShareLinkExpiry((s) => ({ ...s, value: e.target.value }))}
                  sx={{ maxWidth: 140 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    label="Unit"
                    value={shareLinkExpiry.unit}
                    onChange={(e) =>
                      setShareLinkExpiry((s) => ({ ...s, unit: e.target.value as DurationUnit }))
                    }
                  >
                    <MenuItem value="hour">Hours</MenuItem>
                    <MenuItem value="day">Days</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saveM.isPending || settingsQ.isLoading}
              onClick={() => saveM.mutate()}
              sx={{ alignSelf: "flex-start" }}
            >
              Save settings
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

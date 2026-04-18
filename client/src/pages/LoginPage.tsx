import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useForm } from "react-hook-form";

import { useAuth } from "../features/auth/AuthContext";

type FormValues = { username: string; password: string };

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<FormValues>({ defaultValues: { username: "", password: "" } });

  return (
    <Box
      sx={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        py: 6
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.6 }}>
              India Post Tracking
            </Typography>
            <Typography sx={{ opacity: 0.8, mt: 1 }}>
              Sign in to upload consignments and download reports.
            </Typography>
          </Box>

          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                {err ? <Alert severity="error">{err}</Alert> : null}

                <TextField
                  label="Username"
                  autoComplete="username"
                  autoFocus
                  {...register("username", { required: true })}
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password", { required: true })}
                />
                <Button
                  size="large"
                  variant="contained"
                  onClick={handleSubmit(async (v) => {
                    try {
                      setErr(null);
                      await login(v);
                      nav("/", { replace: true });
                    } catch (e: any) {
                      setErr(e?.response?.data?.error?.message || e?.message || "Login failed");
                    }
                  })}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <CircularProgress size={18} sx={{ mr: 1 }} /> Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>

                {/* <Alert severity="info" variant="outlined">
                  SuperAdmin default: <b>superadmin</b> / <b>superadmin</b> (change via API `.env`:
                  `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`).
                </Alert> */}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}


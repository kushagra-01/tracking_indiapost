import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { changeOwnPassword, fetchProfile } from "../api/users";
import { useAuth } from "../features/auth/AuthContext";

export function ProfilePage() {
  const { user } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    enabled: user?.role === "user"
  });

  const pwdM = useMutation({
    mutationFn: (v: { currentPassword: string; password: string }) =>
      changeOwnPassword(v.currentPassword, v.password),
    onSuccess: () => {
      setMsg("Password updated.");
      setErr(null);
      reset();
    },
    onError: (e: unknown) => {
      setMsg(null);
      setErr(
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ||
          (e as Error)?.message ||
          "Failed to update password"
      );
    }
  });

  const { register, handleSubmit, reset, formState } = useForm<{
    currentPassword: string;
    password: string;
    confirm: string;
  }>({
    defaultValues: { currentPassword: "", password: "", confirm: "" }
  });

  const profile = profileQ.data;
  const isSuperadmin = user?.role === "superadmin";

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
        My profile
      </Typography>

      <Card elevation={0}>
        <CardContent>
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 800 }}>Account</Typography>
            <Typography>
              Username: <b>{user?.username}</b>
            </Typography>
            <Typography>
              Role: <b>{user?.role}</b>
            </Typography>
            {!isSuperadmin && profile ? (
              <Chip
                size="small"
                label={profile.active ? "Active" : "Inactive"}
                color={profile.active ? "success" : "default"}
                sx={{ alignSelf: "flex-start" }}
              />
            ) : null}
            {isSuperadmin ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                SuperAdmin credentials are set in server environment variables, not in the user
                database.
              </Alert>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {!isSuperadmin ? (
        <Card elevation={0}>
          <CardContent>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Change password</Typography>
            <Stack
              component="form"
              spacing={2}
              onSubmit={handleSubmit(async (v) => {
                setMsg(null);
                setErr(null);
                if (v.password !== v.confirm) {
                  setErr("New passwords do not match");
                  return;
                }
                await pwdM.mutateAsync({
                  currentPassword: v.currentPassword,
                  password: v.password
                });
              })}
              sx={{ maxWidth: 400 }}
            >
              <TextField
                label="Current password"
                type="password"
                autoComplete="current-password"
                {...register("currentPassword", { required: true, minLength: 6 })}
              />
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                {...register("password", { required: true, minLength: 6 })}
              />
              <TextField
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                {...register("confirm", { required: true, minLength: 6 })}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={pwdM.isPending || formState.isSubmitting}>
                  Save password
                </Button>
              </Box>
              {msg ? <Alert severity="success">{msg}</Alert> : null}
              {err ? <Alert severity="error">{err}</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

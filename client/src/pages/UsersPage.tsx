import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/Key";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { useAuth } from "../features/auth/AuthContext";
import { createUser, deleteUser, fetchUsers, resetUserPassword, type UserRow } from "../api/users";

export function UsersPage() {
  const { user } = useAuth();
  if (user?.role !== "superadmin") {
    return <Alert severity="error">You are not allowed to view this page.</Alert>;
  }

  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const createM = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deleteM = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const resetM = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<{ username: string; password: string }>({
    defaultValues: { username: "", password: "" }
  });

  const { register: regReset, handleSubmit: handleReset, reset: resetResetForm } = useForm<{
    password: string;
  }>({ defaultValues: { password: "" } });

  const rows = useMemo(() => usersQ.data?.items ?? [], [usersQ.data]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>
        User Management
      </Typography>

      <Card elevation={0}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ alignItems: { md: "flex-end" } }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800 }}>Create user</Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                Users can login and track consignments. Only SuperAdmin can manage users.
              </Typography>
            </Box>

            <TextField
              label="Username"
              size="small"
              fullWidth
              {...register("username", { required: true })}
              sx={{ minWidth: { md: 220 } }}
            />
            <TextField
              label="Password"
              size="small"
              type="password"
              fullWidth
              {...register("password", { required: true, minLength: 6 })}
              sx={{ minWidth: { md: 220 } }}
            />
            <Button
              variant="contained"
              disabled={formState.isSubmitting || createM.isPending}
              onClick={handleSubmit(async (v) => {
                await createM.mutateAsync(v);
                reset();
              })}
            >
              Add user
            </Button>
          </Stack>

          {createM.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(createM.error as any)?.response?.data?.error?.message ||
                (createM.error as any)?.message ||
                "Failed to create user"}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card elevation={0}>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>Users</Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              {usersQ.isLoading ? "Loading…" : `${rows.length} user(s)`}
            </Typography>
          </Stack>

          {usersQ.error ? (
            <Alert severity="error">
              {(usersQ.error as any)?.response?.data?.error?.message ||
                (usersQ.error as any)?.message ||
                "Failed to load users"}
            </Alert>
          ) : null}

          <Stack spacing={1} sx={{ mt: 1 }}>
            {rows.map((r) => (
              <Box
                key={r.id}
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)"
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{r.username}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Created: {new Date(r.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <IconButton onClick={() => setResetTarget(r)} title="Reset password">
                    <KeyIcon />
                  </IconButton>
                  <IconButton onClick={() => setDeleteTarget(r)} title="Delete user" color="error">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(resetTarget)}
        onClose={() => {
          setResetTarget(null);
          resetResetForm();
        }}
      >
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Reset password for <b>{resetTarget?.username}</b>
            </Typography>
            <TextField
              label="New password"
              type="password"
              autoFocus
              {...regReset("password", { required: true, minLength: 6 })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setResetTarget(null);
              resetResetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={resetM.isPending}
            onClick={handleReset(async (v) => {
              if (!resetTarget) return;
              await resetM.mutateAsync({ id: resetTarget.id, password: v.password });
              setResetTarget(null);
              resetResetForm();
            })}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete user</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>
            Delete <b>{deleteTarget?.username}</b>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteM.isPending}
            onClick={async () => {
              if (!deleteTarget) return;
              await deleteM.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


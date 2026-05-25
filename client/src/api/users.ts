import { http } from "./http";

export type UserRow = {
  id: string;
  username: string;
  role: "user" | "admin";
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type UserProfile = {
  id: string;
  username: string;
  role: "user" | "admin" | "superadmin";
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export async function fetchUsers(): Promise<{ count: number; items: UserRow[] }> {
  const resp = await http.get("/users");
  return resp.data.data;
}

export async function createUser(args: { username: string; password: string; role?: "user" | "admin" }) {
  const resp = await http.post("/users", { username: args.username, password: args.password, role: args.role || "user" });
  return resp.data.data as UserRow;
}

export async function deleteUser(id: string) {
  const resp = await http.delete(`/users/${id}`);
  return resp.data.data as { deleted: true };
}

export async function resetUserPassword(id: string, password: string) {
  const resp = await http.post(`/users/${id}/reset-password`, { password });
  return resp.data.data as { updated: true };
}

export async function updateUser(id: string, body: { active?: boolean; password?: string }) {
  const resp = await http.patch(`/users/${id}`, body);
  return resp.data.data as UserRow;
}

export async function fetchProfile(): Promise<UserProfile> {
  const resp = await http.get("/auth/me");
  return resp.data.data;
}

export async function changeOwnPassword(currentPassword: string, password: string) {
  const resp = await http.patch("/auth/me/password", { currentPassword, password });
  return resp.data.data as { updated: true };
}

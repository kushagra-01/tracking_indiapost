export type Role = "superadmin" | "admin" | "user";

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
};


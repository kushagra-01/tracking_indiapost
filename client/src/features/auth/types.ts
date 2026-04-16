export type Role = "superadmin" | "user";

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
};


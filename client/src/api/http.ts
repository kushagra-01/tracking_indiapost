import axios from "axios";

/** Trim trailing slash so paths like `/track` join correctly. */
export const apiBaseUrl = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api"
).replace(/\/$/, "");

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000
});

export function setAuthToken(token: string | null) {
  if (token) http.defaults.headers.common.authorization = `Bearer ${token}`;
  else delete http.defaults.headers.common.authorization;
}


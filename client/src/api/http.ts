import axios from "axios";

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export const http = axios.create({
  baseURL,
  timeout: 30_000
});

export function setAuthToken(token: string | null) {
  if (token) http.defaults.headers.common.authorization = `Bearer ${token}`;
  else delete http.defaults.headers.common.authorization;
}


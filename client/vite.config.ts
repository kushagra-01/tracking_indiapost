import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Match client `TRACK_REQUEST_TIMEOUT_MS` / server `SERVER_REQUEST_TIMEOUT_MS`. */
const API_PROXY_TIMEOUT_MS = 900_000

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
        // Large /track batches can run many minutes — avoid proxy closing first
        timeout: API_PROXY_TIMEOUT_MS,
        proxyTimeout: API_PROXY_TIMEOUT_MS
      }
    }
  }
})

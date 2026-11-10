// Vite config: React + Tailwind plugins, an "@" alias for src/, and a dev proxy so /api and /hubs
// (SignalR) requests go to the .NET API. This keeps the browser on one origin, so the auth cookie works without CORS.

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Lets code import from "@/components/..." instead of long relative paths.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5047',
      // SignalR live updates; ws: true lets the WebSocket upgrade pass through the proxy.
      '/hubs': { target: 'http://localhost:5047', ws: true },
    },
  },
})

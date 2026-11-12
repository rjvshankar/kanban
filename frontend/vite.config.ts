// Vite config: React + Tailwind plugins, an "@" alias for src/, and a dev proxy so /api and /hubs
// (SignalR) requests go to the .NET API. This keeps the browser on one origin, so the auth cookie works without CORS.

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// The API address the dev proxy forwards to. Overridable so the end-to-end tests can run their own API on another port.
const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:5047'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Lets code import from "@/components/..." instead of long relative paths.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } }, // base for relative URLs; MSW handlers use this origin
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: { provider: 'v8', reporter: ['text', 'html', 'json-summary'], include: ['src/**/*.{ts,tsx}'], exclude: ['src/components/ui/**', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'] },
  },
  server: {
    proxy: {
      '/api': apiUrl,
      // SignalR live updates; ws: true lets the WebSocket upgrade pass through the proxy.
      '/hubs': { target: apiUrl, ws: true },
    },
  },
})

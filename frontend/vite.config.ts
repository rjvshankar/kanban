// Vite config: React plugin, plus a dev proxy so /api requests go to the .NET API.
// This keeps the browser on one origin, so the auth cookie works without CORS.

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { 
    proxy: { 
      '/api': 'http://localhost:5047' 
    },
  }, 
})

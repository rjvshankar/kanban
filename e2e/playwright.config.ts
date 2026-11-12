import { defineConfig, devices } from '@playwright/test'
import { env } from './helpers/env'

// Boots the whole stack: isolated SQL Server + Mailpit (docker compose), the real .NET API, and the Vite dev server.
// Everything runs on non-default ports so it can run next to the normal dev setup.
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  // No retries: the forgot-password rate limit (3 per IP per 15 minutes) would be used up by a retry.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: env.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // `--wait` blocks until SQL Server is healthy; the API runs its migrations on startup and needs it.
      command: 'docker compose up -d --wait && dotnet run --project ../backend/Api --no-launch-profile --urls ' + env.apiUrl,
      url: `${env.apiUrl}/api/health`,
      timeout: 240_000,
      // Always a fresh API: the forgot-password rate limiter (3 per IP per 15 min) lives in its memory, and the
      // password-reset tests use 2 of those. Reusing a running API across runs would exhaust it.
      reuseExistingServer: false,
      stdout: 'ignore', // SQL/ASP.NET logs drown the test output; startup failures still surface as a timeout
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        'ConnectionStrings__Default': env.connectionString,
        'Jwt__Key': 'e2e-only-signing-key-at-least-32-bytes-long!!',
        'Smtp__Host': 'localhost',
        'Smtp__Port': String(env.smtpPort),
        'Smtp__FromAddress': 'noreply@kanban.e2e',
        'App__FrontendUrl': env.webUrl,
      },
    },
    {
      command: `npm run dev -- --port ${env.webPort} --strictPort`,
      cwd: '../frontend',
      url: env.webUrl,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore', // Vite echoes browser console errors (e.g. SignalR stopping on navigation); not useful here
      env: { VITE_API_URL: env.apiUrl },
    },
  ],
})

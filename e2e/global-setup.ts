import { chromium, type FullConfig } from '@playwright/test'

// A cold Vite dev server optimizes dependencies on first request and may reload the page when it finds more.
// Doing that once up front (instead of inside whichever test runs first) keeps the first tests from flaking.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const path of ['/login', '/register', '/forgot-password', '/reset-password?token=warmup']) {
    await page.goto(baseURL + path, { waitUntil: 'networkidle' })
  }
  await page.waitForTimeout(1000) // let any "dependencies changed, reloading" round finish
  await page.goto(baseURL + '/login', { waitUntil: 'networkidle' })
  await browser.close()
}

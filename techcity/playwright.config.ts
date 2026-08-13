import { defineConfig } from '@playwright/test'

/**
 * Default suite — runs against the dev server (`npm run dev`).
 *
 * tests/prod.spec.ts is excluded here because it targets the built bundle on
 * port 4173; run it with `npm run test:prod`, which starts the preview server
 * automatically (see playwright.prod.config.ts).
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/prod.spec.ts'],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    acceptDownloads: true,
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})

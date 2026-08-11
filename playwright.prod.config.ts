import { defineConfig } from '@playwright/test'

/**
 * Production smoke test — builds the app and serves `dist/` with `vite preview`,
 * so we verify exactly what gets deployed. Run with `npm run test:prod`.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/prod.spec.ts'],
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    acceptDownloads: true,
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const BASE = 'http://localhost:4173/'

/** Smoke-test the real production bundle, not the dev server. */
test('production build works end to end', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 20000 })
  console.log('✓ Production bundle boots')

  // Demo data must be BLOCKED in a production build (VITE_ENABLE_DEMO_DATA unset)
  await page.goto(BASE + '#/settings')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await expect(page.getByRole('button', { name: 'Load demo data' })).toBeDisabled()
  await expect(page.getByText(/Demo data is disabled in this build/)).toBeVisible()
  console.log('✓ Sample data cannot appear in a production build')

  // Full workflow on the real bundle
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Add Customer' }).first().click()
  await page.getByLabel('Name *').first().fill('Production Test')
  await page.getByLabel('Phone *').first().fill('9765432100')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByRole('heading', { name: 'Production Test', level: 1 })).toBeVisible({ timeout: 15000 })

  await page.getByRole('link', { name: 'New Service' }).first().click()
  await page.getByLabel('Service Type').fill('Laptop Repair')
  await page.getByLabel('Complaint / Problem Reported').fill('Not powering on')
  await page.getByLabel('Service Charge').fill('1500')
  await page.getByRole('button', { name: 'Paid in full' }).click()
  await page.getByRole('button', { name: 'Save & mark completed' }).click()
  await expect(page.getByText('Service saved successfully')).toBeVisible({ timeout: 15000 })
  console.log('✓ Customer + service created on the production bundle')

  // The lazily-loaded PDF chunk must resolve when hosted as static files
  const dl = page.waitForEvent('download', { timeout: 40000 })
  await page.getByRole('button', { name: 'Download PDF' }).first().click()
  const download = await dl
  const p = `/tmp/${download.suggestedFilename()}`
  await download.saveAs(p)
  const bytes = fs.readFileSync(p)
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  expect(bytes.length).toBeGreaterThan(3000)
  console.log(`✓ Lazy-loaded PDF chunk works in production (${bytes.length} bytes)`)

  // Deep link straight into a hash route (proves no server rewrites needed)
  await page.goto(BASE + '#/reports')
  await expect(page.getByRole('heading', { name: 'Service Reports', level: 1 })).toBeVisible({ timeout: 15000 })
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Service Reports', level: 1 })).toBeVisible({ timeout: 15000 })
  console.log('✓ Deep links + refresh work on a static host (HashRouter)')

  const real = errors.filter((e) => !e.includes('favicon') && !e.includes('fonts.g'))
  expect(real, real.join('\n')).toEqual([])
  console.log('✓ Zero console errors in production')
})

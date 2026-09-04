import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const BASE = 'http://localhost:5173/'
const DOWNLOADS = path.join(process.cwd(), 'test-downloads')

function extractPdfText(raw: string): string {
  const buf = Buffer.from(raw, 'latin1')
  const parts: string[] = [raw]
  let index = 0
  while (true) {
    const start = buf.indexOf('stream', index)
    if (start === -1) break
    let ds = start + 6
    if (buf[ds] === 0x0d) ds++
    if (buf[ds] === 0x0a) ds++
    const end = buf.indexOf('endstream', ds)
    if (end === -1) break
    try { parts.push(zlib.inflateSync(buf.subarray(ds, end)).toString('latin1')) } catch { /* */ }
    index = end + 9
  }
  const chunks: string[] = []
  const re = /\((?:\\.|[^\\()])*\)/g
  for (const p of parts) {
    let m: RegExpExecArray | null
    while ((m = re.exec(p))) chunks.push(m[0].slice(1, -1).replace(/\\([()\\])/g, '$1'))
  }
  return chunks.join(' ')
}

const errors: string[] = []
test.beforeEach(({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
})
test.afterEach(() => {
  const real = errors.filter((e) => !e.includes('favicon') && !e.includes('fonts.g'))
  expect(real, real.join('\n')).toEqual([])
  errors.length = 0
})

test('editing a service with parts recalculates and persists correctly', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  // Customer
  await page.getByRole('button', { name: 'Add Customer' }).first().click()
  await page.getByLabel('Name *').first().fill('Edit Test Customer')
  await page.getByLabel('Phone *').first().fill('9812345670')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Test Customer', level: 1 })).toBeVisible({ timeout: 15000 })

  // Service with two itemised parts
  await page.getByRole('link', { name: 'New Service' }).first().click()
  await page.getByLabel('Service Type').fill('CCTV Installation')
  await page.getByLabel('Complaint / Problem Reported').fill('New 4 camera setup')
  await page.getByRole('button', { name: 'Add part' }).click()
  await page.getByPlaceholder('Part name (e.g. 12V SMPS)').fill('Dome Camera 2MP')
  await page.getByLabel('Quantity').fill('4')
  await page.getByLabel('Unit price').fill('1500')
  await page.getByRole('button', { name: 'Add part' }).click()
  await page.getByPlaceholder('Part name (e.g. 12V SMPS)').nth(1).fill('1TB HDD')
  await page.getByLabel('Quantity').nth(1).fill('1')
  await page.getByLabel('Unit price').nth(1).fill('2400')

  // Parts cost should auto-fill to 4*1500 + 2400 = 8400
  await expect(page.getByLabel('Parts Cost')).toHaveValue('8400')
  await page.getByLabel('Service Charge').fill('3000')
  await page.getByLabel('Discount').fill('400')
  // Total = 3000 + 8400 - 400 = 11000
  await expect(page.getByText('₹11,000').first()).toBeVisible()
  await page.getByRole('button', { name: 'Paid in full' }).click()
  await page.getByRole('button', { name: 'Save & mark completed' }).click()
  await expect(page.getByText('Service saved successfully')).toBeVisible({ timeout: 15000 })
  console.log('✓ Service created: 2 parts, parts cost auto-filled to ₹8,400, total ₹11,000')

  // Parts table on the detail page
  await expect(page.getByText('Dome Camera 2MP')).toBeVisible()
  await expect(page.getByText('1TB HDD')).toBeVisible()
  await expect(page.getByRole('cell', { name: '₹8,400' })).toBeVisible()

  // ---------- EDIT ----------
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await expect(page.getByRole('heading', { name: /Edit Service/ })).toBeVisible()

  // Existing parts must be loaded into the editor
  await expect(page.getByPlaceholder('Part name (e.g. 12V SMPS)')).toHaveCount(2)
  await expect(page.getByPlaceholder('Part name (e.g. 12V SMPS)').first()).toHaveValue('Dome Camera 2MP')
  await expect(page.getByLabel('Service Charge')).toHaveValue('3000')
  await expect(page.getByLabel('Discount')).toHaveValue('400')
  console.log('✓ Edit form correctly hydrated with existing values and parts')

  // Change quantity 4 -> 6  => parts 6*1500+2400 = 11400, total 3000+11400-400 = 14000
  await page.getByLabel('Quantity').first().fill('6')
  await expect(page.getByLabel('Parts Cost')).toHaveValue('11400')
  await expect(page.getByText('₹14,000').first()).toBeVisible()

  // Remove the second part => parts 9000, total 3000+9000-400 = 11600
  await page.getByLabel('Remove part').nth(1).click()
  await expect(page.getByLabel('Parts Cost')).toHaveValue('9000')
  await expect(page.getByText('₹11,600').first()).toBeVisible()
  console.log('✓ Editing parts recalculates parts cost and total live')

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Service updated')).toBeVisible({ timeout: 15000 })

  // Verify persisted state
  await expect(page.getByText('1TB HDD')).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '6' })).toBeVisible()
  await expect(page.getByText('₹11,600').first()).toBeVisible()
  // Was paid 11000, now total 11600 -> balance 600, Partially Paid
  await expect(page.getByText('Partially Paid').first()).toBeVisible()
  await expect(page.getByText('₹600').first()).toBeVisible()
  console.log('✓ Saved edit persisted: part removed, qty updated, balance recalculated to ₹600')

  // Survives a refresh
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('₹11,600').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('1TB HDD')).toHaveCount(0)
  console.log('✓ Edited service persists after refresh')
})

test('settings changes flow into generated PDFs (branding, terms, GST)', async ({ page }) => {
  test.setTimeout(180_000)
  fs.mkdirSync(DOWNLOADS, { recursive: true })
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  // This test runs in a fresh browser profile, so create its own customer.
  await page.getByRole('button', { name: 'Add Customer' }).first().click()
  await page.getByLabel('Name *').first().fill('PDF Settings Customer')
  await page.getByLabel('Phone *').first().fill('9812345670')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByRole('heading', { name: 'PDF Settings Customer', level: 1 })).toBeVisible({
    timeout: 15000,
  })

  await page.goto(BASE + '#/settings')
  await page.waitForLoadState('networkidle')

  // Business identity + GST
  await page.getByLabel('Business Name').fill('TECH CITY TECHNOLOGY')
  await page.getByLabel('Tagline').fill('Computer Sales • Service • CCTV • Networking')
  await page.getByLabel('Address').fill('45 Cross Cut Road, Gandhipuram, Coimbatore - 641012')
  await page.getByLabel('Phone', { exact: true }).fill('+91 90000 11111')
  await page.getByLabel('Email').fill('care@techcity.in')
  await page.getByText('Enable GST / tax on invoices').click()
  await page.getByLabel('GST Number').fill('33ABCDE1234F1Z5')
  await page.getByLabel('Default Tax %').fill('18')
  await page.getByRole('button', { name: 'Save Business Details' }).click()
  await expect(page.getByText('Business details saved')).toBeVisible({ timeout: 15000 })
  console.log('✓ Business settings saved with GST enabled at 18%')

  // Custom terms + footer
  await page.getByRole('button', { name: 'PDF & Invoice' }).click()
  await page.getByLabel('Footer Text').fill('Thank you for choosing TECH CITY TECHNOLOGY')
  await page.getByLabel('Terms & Conditions').fill('1. Custom warranty term for testing.\n2. Second custom term.')
  await page.getByRole('button', { name: 'Save Document Settings' }).click()
  await expect(page.getByText('Document settings saved')).toBeVisible({ timeout: 15000 })

  // New service — tax field must now appear and apply
  await page.goto(BASE + '#/services/new')
  await page.getByPlaceholder('Search existing customer').fill('9812345670')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /PDF Settings Customer/ }).first().click()
  await page.getByLabel('Service Type').fill('Laptop Repair')
  await page.getByLabel('Complaint / Problem Reported').fill('Screen replacement')
  await page.getByLabel('Service Charge').fill('1000')
  // Tax field is visible because GST is enabled
  await expect(page.getByLabel('Tax / GST %')).toHaveValue('18')
  // Total = 1000 + 18% = 1180
  await expect(page.getByText('₹1,180').first()).toBeVisible()
  console.log('✓ GST toggle adds an 18% tax line: ₹1,000 → ₹1,180')

  await page.getByRole('button', { name: 'Save & mark completed' }).click()
  await expect(page.getByText('Service saved successfully')).toBeVisible({ timeout: 15000 })

  // Download the invoice and confirm the new settings are inside the PDF.
  // The success banner carries a Report (Delivery Challan) action set, so pick
  // the last Download PDF button — the Customer Copy set bound to the invoice.
  await page.getByRole('button', { name: 'Invoice', exact: true }).click()
  const dl = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('button', { name: 'Download PDF' }).last().click()
  const download = await dl
  const p = path.join(DOWNLOADS, download.suggestedFilename())
  await download.saveAs(p)
  const text = extractPdfText(fs.readFileSync(p).toString('latin1'))

  for (const needle of [
    '45 Cross Cut Road',
    '+91 90000 11111',
    'care@techcity.in',
    'GSTIN: 33ABCDE1234F1Z5',
    'Custom warranty term for testing',
    'Tax / GST (18%)',
    '1,180.00',
    'Thank you for choosing TECH CITY TECHNOLOGY',
  ]) {
    expect(text, `PDF should contain "${needle}"`).toContain(needle)
  }
  console.log('✓ PDF reflects saved address, phone, email, GSTIN, custom terms, tax line and footer')

  // Reset GST so it does not leak into other runs
  await page.goto(BASE + '#/settings')
  await page.getByText('Enable GST / tax on invoices').click()
  await page.getByRole('button', { name: 'Save Business Details' }).click()
  await expect(page.getByText('Business details saved')).toBeVisible({ timeout: 15000 })
})

test('reports page: delete asks for confirmation and can be cancelled', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto(BASE + '#/settings')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible({ timeout: 60000 })

  await page.goto(BASE + '#/reports')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)

  const totalText = async () => {
    const t = await page.getByText(/of\s+\d+\s+reports/).textContent()
    return Number(/of\s+(\d+)\s+reports/.exec(t ?? '')?.[1] ?? 0)
  }
  const before = await totalText()
  expect(before).toBeGreaterThan(0)

  // Cancelling must NOT delete anything
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await expect(page.getByText('Delete this service report?')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(600)
  expect(await totalText()).toBe(before)
  console.log(`✓ Cancelling the delete confirmation keeps all ${before} records`)

  // Confirming removes exactly one
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByText('Report deleted')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(900)
  expect(await totalText()).toBe(before - 1)
  console.log(`✓ Confirming the delete removes exactly one report (${before} → ${before - 1})`)
})

test('empty states appear when there is no data', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto(BASE + '#/settings')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Delete all data' }).click()
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page.getByText('All data deleted')).toBeVisible({ timeout: 20000 })

  const checks: [string, string][] = [
    ['#/customers', 'No customers yet'],
    ['#/services', 'No services found'],
    ['#/reports', 'No service reports yet'],
    ['#/equipment', 'No equipment recorded'],
    ['#/reminders', 'No reminders'],
    ['#/payments', 'No pending payments'],
  ]
  for (const [hash, message] of checks) {
    await page.goto(BASE + hash)
    await page.waitForTimeout(700)
    await expect(page.getByText(message)).toBeVisible({ timeout: 10000 })
  }
  console.log('✓ All six empty states render with helpful guidance')

  // Dashboard shows zeros, not fake numbers
  await page.goto(BASE + '#/')
  await page.waitForTimeout(1000)
  await expect(page.getByText('No services yet')).toBeVisible()
  const total = await page.locator('a', { hasText: 'Total Customers' }).locator('p').nth(1).textContent()
  expect(total?.trim()).toBe('0')
  console.log('✓ Dashboard shows 0 (real data), not placeholder numbers')
})

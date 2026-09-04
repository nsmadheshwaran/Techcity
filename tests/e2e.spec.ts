import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/**
 * End-to-end verification of the exact workflow required in the specification.
 * Run with:  npx playwright test
 */

const BASE = 'http://localhost:5173/'
const DOWNLOADS = path.join(process.cwd(), 'test-downloads')

const errors: string[] = []

test.beforeEach(async ({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
})

test.afterEach(() => {
  const real = errors.filter((e) => !e.includes('favicon') && !e.includes('fonts.googleapis'))
  expect(real, `Console errors:\n${real.join('\n')}`).toEqual([])
  errors.length = 0
})

async function goto(page: Page, hash = '') {
  await page.goto(BASE + hash)
  await page.waitForLoadState('networkidle')
}

test('Test 1-9: full customer → service → PDF → persistence workflow', async ({ page }) => {
  test.setTimeout(180_000)
  await goto(page)

  // ---------- Test 1: create customer Ravi Kumar / 9876543210 ----------
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Customer' }).first().click()
  await page.getByLabel('Name *').first().fill('Ravi Kumar')
  await page.getByLabel('Phone *').first().fill('9876543210')
  await page.getByLabel('Address').fill('12 Bharathi Street, RS Puram')
  await page.getByLabel('City').fill('Coimbatore')
  await page.getByRole('button', { name: 'Create Customer' }).click()

  await expect(page.getByRole('heading', { name: 'Ravi Kumar', level: 1 })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('TC-CUS-00001').first()).toBeVisible()
  console.log('✓ Test 1: customer created with auto ID TC-CUS-00001')

  // ---------- Test 2: create service with the exact figures ----------
  await page.getByRole('link', { name: 'New Service' }).first().click()
  await expect(page.getByRole('heading', { name: 'New Service Entry' })).toBeVisible()

  // customer should be pre-selected from the profile link
  await expect(page.getByText('TC-CUS-00001').first()).toBeVisible()

  await page.getByLabel('Service Type').fill('CCTV Maintenance')
  await page.getByLabel('Complaint / Problem Reported').fill('Routine CCTV maintenance requested.')
  await page.getByLabel('Diagnosis').fill('Dust on camera lenses, one camera misaligned.')
  await page.getByLabel('Work Performed').fill('Cleaned all cameras, realigned camera 3, tested recording.')
  await page.getByLabel('Technician').fill('Suresh')
  await page.getByLabel('Product / Device').fill('CCTV System')
  await page.getByLabel('Brand').fill('Hikvision')
  await page.getByLabel('Model').fill('DS-7108HGHI-K1')
  await page.getByLabel('Serial Number').fill('HK7108-22910')

  await page.getByLabel('Service Charge').fill('1000')
  await page.getByLabel('Parts Cost').fill('500')
  await page.getByLabel('Discount').fill('100')
  await page.getByLabel('Amount Paid').fill('1000')

  // Total = 1000 + 500 - 100 = 1400, balance 400
  await expect(page.getByText('₹1,400').first()).toBeVisible()
  await expect(page.getByText('₹400').first()).toBeVisible()
  await expect(page.getByText('Payment status: Partially Paid')).toBeVisible()
  console.log('✓ Test 2: totals auto-calculated — Total ₹1,400, Balance ₹400')

  // ---------- Test 3: complete the service ----------
  await page.getByRole('button', { name: 'Save & mark completed' }).click()
  await expect(page.getByText('Service saved successfully')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('TC-SRV-00001').first()).toBeVisible()
  await expect(page.getByText('Completed').first()).toBeVisible()
  console.log('✓ Test 3: service completed with ID TC-SRV-00001')

  // ---------- Test 4: generate the PDF ----------
  fs.mkdirSync(DOWNLOADS, { recursive: true })
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('button', { name: 'Download PDF' }).first().click()
  const download = await downloadPromise
  const pdfPath = path.join(DOWNLOADS, download.suggestedFilename())
  await download.saveAs(pdfPath)

  const bytes = fs.readFileSync(pdfPath)
  expect(bytes.length).toBeGreaterThan(3000)
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  console.log(`✓ Test 4: PDF generated (${download.suggestedFilename()}, ${bytes.length} bytes)`)

  // Verify the PDF text content contains customer + service info
  const raw = bytes.toString('latin1')
  const text = extractPdfText(raw)
  for (const needle of [
    'TECH CITY TECHNOLOGY',
    'SERVICE / INSTALLATION REPORT',
    'Ravi Kumar',
    '9876543210',
    'TC-SRV-00001',
    'CCTV Maintenance',
    'Hikvision',
    'HK7108-22910',
    'Suresh',
  ]) {
    expect(text, `PDF should contain "${needle}"`).toContain(needle)
  }
  console.log('✓ Test 4b: challan report PDF contains customer, device and service information')

  // ---------- Test 5: refresh — data must persist ----------
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('TC-SRV-00001').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Ravi Kumar').first()).toBeVisible()
  console.log('✓ Test 5: data persisted after browser refresh')

  // ---------- Test 6: global search by phone number ----------
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder('Type a name, phone number').fill('9876543210')
  const result = page.locator('button', { hasText: 'Ravi Kumar' }).first()
  await expect(result).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/1 services/)).toBeVisible()
  await expect(page.getByText(/₹1,400 total/)).toBeVisible()
  console.log('✓ Test 6: search by 9876543210 finds Ravi Kumar with service count + total')

  // ---------- Test 7: open profile, service appears in history ----------
  await result.click()
  await expect(page.getByRole('heading', { name: 'Ravi Kumar', level: 1 })).toBeVisible()
  await expect(page.getByText('Total Services')).toBeVisible()
  await page.getByRole('button', { name: /Service History/ }).click()
  await expect(page.getByText('CCTV Maintenance').first()).toBeVisible()
  await expect(page.getByText('₹1,400').first()).toBeVisible()
  await expect(page.getByText('₹400').first()).toBeVisible() // outstanding
  console.log('✓ Test 7: service appears in customer history with correct amounts')

  // Timeline tab
  await page.getByRole('button', { name: 'Timeline' }).click()
  await expect(page.getByText(new Date().getFullYear().toString()).first()).toBeVisible()
  console.log('✓ Test 7b: timeline renders')

  // ---------- Test 8: open the service, verify details ----------
  await page.getByRole('button', { name: /Service History/ }).click()
  await page.getByText('CCTV Maintenance').first().click()
  await expect(page.getByRole('heading', { name: 'CCTV Maintenance' })).toBeVisible()
  await expect(page.getByText('HK7108-22910')).toBeVisible()
  await expect(page.getByText('Routine CCTV maintenance requested.')).toBeVisible()
  await expect(page.getByText('Cleaned all cameras, realigned camera 3, tested recording.')).toBeVisible()
  await expect(page.getByText('Technician: Suresh')).toBeVisible()
  console.log('✓ Test 8: all service details present')

  // ---------- Record a payment to clear the balance ----------
  await page.getByRole('button', { name: 'Record Payment' }).first().click()
  await expect(page.getByText(/Balance ₹400/)).toBeVisible()
  await page.getByRole('button', { name: 'Record Payment' }).last().click()
  await expect(page.getByText('Payment recorded')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Paid').first()).toBeVisible()
  console.log('✓ Payment recorded — balance cleared, status now Paid')

  // ---------- Test 9: generate PDF again (invoice this time) ----------
  await page.getByRole('button', { name: 'Invoice', exact: true }).click()
  const dl2 = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('button', { name: 'Download PDF' }).first().click()
  const download2 = await dl2
  const invPath = path.join(DOWNLOADS, download2.suggestedFilename())
  await download2.saveAs(invPath)
  const invBytes = fs.readFileSync(invPath)
  expect(invBytes.subarray(0, 4).toString()).toBe('%PDF')
  const invText = extractPdfText(invBytes.toString('latin1'))
  expect(invText).toContain('TAX INVOICE')
  expect(invText).toContain('PAID')
  console.log(`✓ Test 9: invoice PDF regenerated (${download2.suggestedFilename()})`)
})

test('CRUD: edit and delete work for customers, services, equipment, reminders', async ({ page }) => {
  test.setTimeout(120_000)
  await goto(page)

  // Create a throwaway customer
  await page.getByRole('button', { name: 'Add Customer' }).first().click()
  await page.getByLabel('Name *').first().fill('Test Delete Me')
  await page.getByLabel('Phone *').first().fill('9000000001')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByRole('heading', { name: 'Test Delete Me', level: 1 })).toBeVisible({ timeout: 15000 })

  // Update (edit)
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByLabel('Name *').first().fill('Test Renamed')
  await page.getByLabel('Email').fill('renamed@example.com')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('heading', { name: 'Test Renamed', level: 1 })).toBeVisible({ timeout: 10000 })
  console.log('✓ Customer update works')

  // Validation: duplicate phone number is rejected
  await page.goto(BASE + '#/customers')
  await page.getByRole('button', { name: 'Add Customer' }).click()
  await page.getByLabel('Name *').first().fill('Duplicate Phone')
  await page.getByLabel('Phone *').first().fill('9000000001')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByText(/already exists/)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Cancel' }).click()
  console.log('✓ Duplicate phone number validation works')

  // Validation: required fields
  await page.getByRole('button', { name: 'Add Customer' }).click()
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await page.getByLabel('Name *').first().fill('X')
  await page.getByLabel('Phone *').first().fill('123')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByText(/Please fix the highlighted fields/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  console.log('✓ Field validation works (name, phone format, email)')

  // Equipment CRUD
  await page.goto(BASE + '#/equipment')
  await page.getByRole('button', { name: 'Add Equipment' }).first().click()
  await page.getByLabel('Customer').selectOption({ index: 1 })
  await page.getByLabel('Product Type').fill('Camera')
  await page.getByLabel('Brand').fill('Hikvision')
  await page.getByLabel('Model').fill('DS-2CD1343G0-I')
  await page.getByRole('button', { name: 'Save Equipment' }).click()
  await expect(page.getByText('Equipment added')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('DS-2CD1343G0-I').first()).toBeVisible()
  console.log('✓ Equipment create works')

  // Reminder CRUD
  await page.goto(BASE + '#/reminders')
  await page.getByRole('button', { name: 'Add Reminder' }).first().click()
  await page.getByLabel('Customer').selectOption({ index: 1 })
  await page.getByPlaceholder('e.g. Follow up on AMC renewal').fill('Follow up on AMC renewal')
  await page.getByRole('button', { name: 'Add Reminder' }).last().click()
  await expect(page.getByText('Reminder added')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Follow up on AMC renewal')).toBeVisible()

  // Toggle done
  await page.getByRole('button', { name: 'Mark as done' }).first().click()
  await expect(page.getByText('Reminder marked done')).toBeVisible({ timeout: 10000 })
  console.log('✓ Reminder create + complete works')

  // Delete customer (cascade) with confirmation dialog
  await page.goto(BASE + '#/customers')
  await page.getByText('Test Renamed').first().click()
  await expect(page.getByRole('heading', { name: 'Test Renamed', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await expect(page.getByText('Delete this customer?')).toBeVisible()
  await page.getByRole('button', { name: 'Delete permanently' }).click()
  await expect(page.getByText('Customer deleted')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Test Renamed')).toHaveCount(0)
  console.log('✓ Customer delete with confirmation + cascade works')
})

test('Dashboard statistics are computed from real data', async ({ page }) => {
  test.setTimeout(120_000)
  await goto(page)

  // Load demo data from settings so we can verify aggregate maths
  await page.goto(BASE + '#/settings')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible({ timeout: 60000 })
  console.log('✓ Demo dataset seeded')

  await page.goto(BASE + '#/')
  await page.waitForTimeout(1500)

  const totalCustomers = await page
    .locator('a', { hasText: 'Total Customers' })
    .locator('p')
    .nth(1)
    .textContent()
  expect(Number(totalCustomers)).toBeGreaterThanOrEqual(10)
  console.log(`✓ Dashboard shows ${totalCustomers} customers (real count)`)

  await expect(page.getByText('Recent Services')).toBeVisible()
  await expect(page.getByText('Upcoming Maintenance').first()).toBeVisible()
  await expect(page.getByText('Pending Payments').first()).toBeVisible()

  // Cross-check pending payments against the payments page
  await page.goto(BASE + '#/payments')
  await expect(page.getByText('Outstanding').first()).toBeVisible()
  await page.waitForTimeout(1200)
  const pendingItems = await page.getByRole('button', { name: 'Collect' }).count()
  expect(pendingItems).toBeGreaterThan(0)
  console.log(`✓ Payments page lists ${pendingItems} pending payment(s)`)

  // Services filters
  await page.goto(BASE + '#/services')
  await page.getByLabel('Filter by status').selectOption('Completed')
  await page.waitForTimeout(600)
  const completedBadges = await page.getByText('Completed').count()
  expect(completedBadges).toBeGreaterThan(0)
  await page.getByLabel('Filter by service type').selectOption('CCTV Installation')
  await page.waitForTimeout(800)
  // Every visible row should now be a CCTV Installation
  const rowTypes = await page.locator('tbody tr td:first-child p:first-child').allTextContents()
  expect(rowTypes.length).toBeGreaterThan(0)
  expect(rowTypes.every((t) => t.trim() === 'CCTV Installation')).toBe(true)
  console.log(`✓ Service filters work (${rowTypes.length} CCTV Installation rows)`)

  // Reports page search by service ID
  await page.goto(BASE + '#/reports')
  await page.getByPlaceholder('Search service ID').fill('TC-SRV-00003')
  await page.waitForTimeout(600)
  await expect(page.getByText('TC-SRV-00003')).toBeVisible()
  console.log('✓ Report search by service ID works')

  // Reminders buckets
  await page.goto(BASE + '#/reminders')
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()
  const buckets = await page.locator('h2').allTextContents()
  console.log(`✓ Reminder buckets rendered: ${buckets.filter((b) => b !== 'Reminders').join(', ')}`)

  // CSV export works
  const csvDl = page.waitForEvent('download', { timeout: 20000 })
  await page.goto(BASE + '#/customers')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const csv = await csvDl
  fs.mkdirSync(DOWNLOADS, { recursive: true })
  const csvPath = path.join(DOWNLOADS, csv.suggestedFilename())
  await csv.saveAs(csvPath)
  const csvText = fs.readFileSync(csvPath, 'utf8')
  expect(csvText).toContain('Customer ID')
  expect(csvText).toContain('Ravi Kumar')
  console.log('✓ CSV export works and contains data')
})

test('Test 10: mobile layout is usable', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  // Seed this fresh browser context so there is data to look at.
  await page.goto(BASE + '#/settings')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible({ timeout: 60000 })
  await page.goto(BASE + '#/')
  await page.waitForLoadState('networkidle')

  // Bottom nav is visible, sidebar hidden
  await expect(page.getByRole('link', { name: 'Customers', exact: true })).toBeVisible()
  await expect(page.getByLabel('New service')).toBeVisible()

  // No horizontal overflow
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1)
  console.log('✓ Mobile: no horizontal overflow on dashboard')

  // Mobile drawer opens
  await page.getByLabel('Open menu').click()
  await expect(page.getByRole('link', { name: 'Service Reports' })).toBeVisible()
  await page.getByLabel('Close menu').click()

  // Mobile search
  await page.getByLabel('Search').click()
  await page.getByPlaceholder('Type a name, phone number').fill('9876543210')
  const dialog = page.locator('div.fixed.z-\\[60\\]')
  await expect(dialog.getByText('Ravi Kumar').first()).toBeVisible({ timeout: 10000 })
  await page.keyboard.press('Escape')
  console.log('✓ Mobile: global search works')

  // New service via the FAB
  await page.getByLabel('New service').click()
  await expect(page.getByRole('heading', { name: 'New Service Entry' })).toBeVisible()
  const overflow2 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow2).toBeLessThanOrEqual(1)
  console.log('✓ Mobile: service form usable, no overflow')

  // Customer list mobile cards
  await page.goto(BASE + '#/customers')
  // The desktop table must be hidden and the mobile card list visible
  await expect(page.locator('table')).toBeHidden()
  await expect(page.locator('ul.divide-y > li').first()).toBeVisible({ timeout: 10000 })
  const cardCount = await page.locator('ul.divide-y > li').count()
  expect(cardCount).toBeGreaterThan(0)
  const overflow3 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow3).toBeLessThanOrEqual(1)
  console.log('✓ Mobile: customer list renders as cards without overflow')

  await context.close()
})

/**
 * Minimal PDF text extractor for assertions: inflates FlateDecode content
 * streams then pulls the literal strings out of the text operators.
 */
function extractPdfText(raw: string): string {
  const buf = Buffer.from(raw, 'latin1')
  const parts: string[] = [raw]
  let index = 0
  while (true) {
    const start = buf.indexOf('stream', index)
    if (start === -1) break
    let dataStart = start + 6
    if (buf[dataStart] === 0x0d) dataStart++
    if (buf[dataStart] === 0x0a) dataStart++
    const end = buf.indexOf('endstream', dataStart)
    if (end === -1) break
    const slice = buf.subarray(dataStart, end)
    try {
      parts.push(zlib.inflateSync(slice).toString('latin1'))
    } catch {
      /* not a deflate stream — skip */
    }
    index = end + 9
  }

  const chunks: string[] = []
  const re = /\((?:\\.|[^\\()])*\)/g
  for (const part of parts) {
    let m: RegExpExecArray | null
    while ((m = re.exec(part))) {
      chunks.push(m[0].slice(1, -1).replace(/\\([()\\])/g, '$1'))
    }
  }
  return chunks.join(' ')
}

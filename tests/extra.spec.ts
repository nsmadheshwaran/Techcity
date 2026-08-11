import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5173/'
const DOWNLOADS = path.join(process.cwd(), 'test-downloads')

test('performance: 2000 services stay fast and paginated', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  // Bulk-insert directly into IndexedDB via the app's own Dexie instance
  const inserted = await page.evaluate(async () => {
    const Dexie = (await import('/node_modules/dexie/dist/modern/dexie.mjs')).default
    const db = new Dexie('techcity_db')
    db.version(1).stores({
      customers: 'id, code, name, phone, altPhone, email, city, dateAdded, createdAt, isDemo',
      services:
        'id, code, customerId, serviceDate, serviceType, status, paymentStatus, nextServiceDate, warrantyExpiry, createdAt, isDemo',
      serviceParts: 'id, serviceId, createdAt',
      payments: 'id, serviceId, customerId, date, createdAt',
      equipment: 'id, code, customerId, productType, status, warrantyExpiry, createdAt, isDemo',
      reminders: 'id, customerId, serviceId, type, dueDate, done, createdAt, isDemo',
      settings: 'id',
      users: 'id',
      counters: 'key',
    })
    await db.open()
    const now = new Date().toISOString()
    const customers = []
    for (let i = 0; i < 200; i++) {
      customers.push({
        id: `perf-c-${i}`,
        code: `TC-CUS-9${String(i).padStart(4, '0')}`,
        name: `Perf Customer ${i}`,
        phone: `90000${String(i).padStart(5, '0')}`,
        dateAdded: '2026-01-01',
        createdAt: now,
        updatedAt: now,
      })
    }
    const services = []
    for (let i = 0; i < 2000; i++) {
      const total = 500 + (i % 50) * 25
      services.push({
        id: `perf-s-${i}`,
        code: `TC-SRV-9${String(i).padStart(5, '0')}`,
        customerId: `perf-c-${i % 200}`,
        serviceDate: `2026-0${(i % 8) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
        serviceType: ['Laptop Repair', 'CCTV Maintenance', 'Networking'][i % 3],
        status: ['Completed', 'In Progress', 'Received'][i % 3],
        complaint: `Perf complaint ${i}`,
        serviceCharge: total,
        partsCost: 0,
        discount: 0,
        taxPercent: 0,
        totalAmount: total,
        amountPaid: i % 4 === 0 ? 0 : total,
        balance: i % 4 === 0 ? total : 0,
        paymentStatus: i % 4 === 0 ? 'Pending' : 'Paid',
        createdAt: now,
        updatedAt: now,
      })
    }
    await db.customers.bulkPut(customers)
    await db.services.bulkPut(services)
    return { customers: await db.customers.count(), services: await db.services.count() }
  })
  console.log(`Inserted → ${inserted.customers} customers, ${inserted.services} services`)
  expect(inserted.services).toBeGreaterThanOrEqual(2000)

  for (const [hash, label] of [
    ['#/', 'Dashboard'],
    ['#/services', 'Services'],
    ['#/customers', 'Customers'],
    ['#/payments', 'Payments'],
  ] as const) {
    const t0 = Date.now()
    await page.goto(BASE + hash)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    const ms = Date.now() - t0
    console.log(`  ${label} rendered in ${ms}ms with 2000 services`)
    expect(ms, `${label} should render in under 8s`).toBeLessThan(8000)
  }

  // Pagination keeps the DOM small
  await page.goto(BASE + '#/services')
  await page.waitForTimeout(1200)
  const rows = await page.locator('tbody tr').count()
  expect(rows).toBeLessThanOrEqual(20)
  await expect(page.getByText(/of\s+2,?\d+\s+services/)).toBeVisible()
  console.log(`✓ Pagination limits the table to ${rows} rows per page`)

  // Search stays responsive
  const t1 = Date.now()
  await page.getByPlaceholder('Search service ID').fill('TC-SRV-901500')
  await page.waitForTimeout(500)
  await expect(page.getByText('TC-SRV-901500').first()).toBeVisible()
  console.log(`✓ Search over 2000 records resolved in ${Date.now() - t1}ms`)
})

test('backup export and restore round-trip', async ({ page }) => {
  test.setTimeout(180_000)
  fs.mkdirSync(DOWNLOADS, { recursive: true })
  await page.goto(BASE + '#/settings')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible({ timeout: 60000 })

  const dl = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('button', { name: 'Download Full Backup (JSON)' }).click()
  const download = await dl
  const backupPath = path.join(DOWNLOADS, download.suggestedFilename())
  await download.saveAs(backupPath)
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
  expect(backup.app).toBe('tech-city-technology')
  expect(backup.data.customers.length).toBeGreaterThanOrEqual(10)
  expect(backup.data.services.length).toBeGreaterThanOrEqual(20)
  console.log(
    `✓ Backup exported: ${backup.data.customers.length} customers, ${backup.data.services.length} services, ${backup.data.serviceParts.length} parts, ${backup.data.payments.length} payments`,
  )

  // Wipe everything
  await page.getByRole('button', { name: 'Delete all data' }).click()
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page.getByText('All data deleted')).toBeVisible({ timeout: 20000 })
  await page.goto(BASE + '#/customers')
  await expect(page.getByText('No customers yet')).toBeVisible({ timeout: 15000 })
  console.log('✓ Wipe all data works')

  // Restore
  await page.goto(BASE + '#/settings')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.setInputFiles('input[type=file][accept*="json"]', backupPath)
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByText('Backup restored')).toBeVisible({ timeout: 30000 })
  await page.goto(BASE + '#/customers')
  await expect(page.getByText('Ravi Kumar').first()).toBeVisible({ timeout: 15000 })
  console.log('✓ Restore from backup works — data is back')
})

test('passcode lock protects records', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto(BASE + '#/settings')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Security' }).click()
  await page.getByLabel('Passcode', { exact: true }).first().fill('1234')
  await page.getByLabel('Confirm Passcode').fill('1234')
  await page.getByRole('button', { name: 'Enable Passcode Lock' }).click()
  await expect(page.getByText('Passcode enabled')).toBeVisible({ timeout: 15000 })
  console.log('✓ Passcode enabled')

  // Lock and confirm the lock screen appears
  await page.getByLabel('Lock').click()
  await expect(page.getByText('Enter passcode to continue')).toBeVisible({ timeout: 10000 })

  // Wrong passcode is rejected
  await page.getByPlaceholder('Passcode', { exact: true }).fill('9999')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Incorrect passcode. Please try again.')).toBeVisible()
  console.log('✓ Wrong passcode rejected')

  // Correct passcode unlocks
  await page.getByPlaceholder('Passcode', { exact: true }).fill('1234')
  await page.getByRole('button', { name: 'Unlock' }).click()
  // The user is returned to the page they were on when they locked (Settings).
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({
    timeout: 15000,
  })
  console.log('✓ Correct passcode unlocks the app')

  // Reload still requires nothing (session remembered), then remove the lock
  await page.goto(BASE + '#/settings')
  await page.getByRole('button', { name: 'Security' }).click()
  await page.getByLabel('Current Passcode').fill('1234')
  await page.getByRole('button', { name: 'Remove passcode' }).click()
  await expect(page.getByText('Passcode removed')).toBeVisible({ timeout: 15000 })
  console.log('✓ Passcode removal works')
})

test('WhatsApp share opens a pre-filled message', async ({ context, page }) => {
  test.setTimeout(120_000)
  await page.goto(BASE + '#/settings')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible({ timeout: 60000 })

  await page.goto(BASE + '#/services')
  await page.waitForTimeout(1200)
  await page.locator('tbody tr').first().click()
  await page.waitForTimeout(800)

  const popupPromise = context.waitForEvent('page', { timeout: 20000 })
  await page.getByRole('button', { name: 'WhatsApp' }).first().click()
  const popup = await popupPromise
  const url = popup.url()
  expect(url).toMatch(/(wa\.me\/91|whatsapp\.com\/send\/?\?phone=91)/)
  const decoded = decodeURIComponent(url).replace(/\+/g, ' ')
  expect(decoded).toContain('Thank you for choosing')
  expect(decoded).toContain('Service ID: TC-SRV-')
  expect(decoded).toContain('TECH CITY TECHNOLOGY')
  console.log('✓ WhatsApp deep link contains the pre-filled service message')
  await popup.close()
})

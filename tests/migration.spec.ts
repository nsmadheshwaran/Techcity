import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173/'

/**
 * Verifies the v1 → v2 upgrade (service_parts gained a `position` column).
 * An existing shop already has v1 data on disk — the upgrade must preserve it
 * and backfill the ordering rather than losing rows.
 */
test('v1 database upgrades to v2 without losing data', async ({ page }) => {
  test.setTimeout(180_000)

  // Land on the app once so the origin exists, then wipe and write a v1 database.
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  const seeded = await page.evaluate(async () => {
    // Close whatever the app opened and delete it so we can recreate at v1.
    const Dexie = (await import('/node_modules/dexie/dist/modern/dexie.mjs')).default
    await Dexie.delete('techcity_db')

    const v1 = new Dexie('techcity_db')
    v1.version(1).stores({
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
    await v1.open()

    const t = '2026-08-01T10:00:00.000Z'
    await v1.table('customers').put({
      id: 'legacy-c1', code: 'TC-CUS-00001', name: 'Legacy Customer',
      phone: '9871230000', dateAdded: '2026-08-01', createdAt: t, updatedAt: t,
    })
    await v1.table('services').put({
      id: 'legacy-s1', code: 'TC-SRV-00001', customerId: 'legacy-c1',
      serviceDate: '2026-08-01', serviceType: 'CCTV Installation', status: 'Completed',
      complaint: 'Legacy service record', serviceCharge: 2000, partsCost: 3000,
      discount: 0, taxPercent: 0, totalAmount: 5000, amountPaid: 5000, balance: 0,
      paymentStatus: 'Paid', createdAt: t, updatedAt: t,
    })
    // Three parts WITHOUT a position field, written out of alphabetical order
    // so we can prove the backfill uses createdAt (true entry order).
    const parts = [
      { id: 'p-zzz', name: 'Zulu Camera',  createdAt: '2026-08-01T10:00:01.000Z' },
      { id: 'p-aaa', name: 'Alpha Cable',  createdAt: '2026-08-01T10:00:02.000Z' },
      { id: 'p-mmm', name: 'Mike Adapter', createdAt: '2026-08-01T10:00:03.000Z' },
    ]
    for (const p of parts) {
      await v1.table('serviceParts').put({
        id: p.id, serviceId: 'legacy-s1', name: p.name,
        quantity: 1, unitPrice: 1000, total: 1000,
        createdAt: p.createdAt, updatedAt: p.createdAt,
      })
    }
    const count = await v1.table('serviceParts').count()
    v1.close()
    return { parts: count, version: v1.verno }
  })

  expect(seeded.parts).toBe(3)
  console.log(`✓ Wrote a v1 database with ${seeded.parts} parts and no "position" column`)

  // Full reload (not just a hash change) so the app reopens and upgrades the DB.
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.goto(BASE + '#/customers')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Legacy Customer').first()).toBeVisible({ timeout: 20000 })
  console.log('✓ Legacy customer survived the upgrade')

  await page.goto(BASE + '#/services')
  await page.waitForTimeout(1200)
  await page.locator('tbody tr').first().click()
  await expect(page.getByRole('heading', { name: 'CCTV Installation', level: 1 })).toBeVisible({
    timeout: 15000,
  })

  // All three parts are still there, in original entry order, with positions backfilled.
  const rows = await page.locator('tbody tr td:first-child').allTextContents()
  const names = rows.filter((r) => /Camera|Cable|Adapter/.test(r))
  expect(names).toEqual(['Zulu Camera', 'Alpha Cable', 'Mike Adapter'])
  console.log(`✓ All 3 parts preserved in entry order: ${names.join(' → ')}`)

  const positions = await page.evaluate(async () => {
    const Dexie = (await import('/node_modules/dexie/dist/modern/dexie.mjs')).default
    const db = new Dexie('techcity_db')
    await db.open() // opens at the current (v2) version
    const rows = await db.table('serviceParts').toArray()
    const version = db.verno
    db.close()
    return { version, positions: rows.map((r: { name: string; position?: number }) => [r.name, r.position]) }
  })
  expect(positions.version).toBe(5)
  expect(positions.positions.sort((a: [string, number], b: [string, number]) => a[1] - b[1]))
    .toEqual([['Zulu Camera', 0], ['Alpha Cable', 1], ['Mike Adapter', 2]])
  console.log(`✓ Database upgraded to v${positions.version} and positions were backfilled 0,1,2`)

  // Editing still works after the upgrade
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await expect(page.getByPlaceholder('Part name (e.g. 12V SMPS)')).toHaveCount(3)
  await expect(page.getByPlaceholder('Part name (e.g. 12V SMPS)').first()).toHaveValue('Zulu Camera')
  console.log('✓ Editing an upgraded record loads its parts in the right order')

  const real = errors.filter((e) => !e.includes('favicon') && !e.includes('fonts.g'))
  expect(real, real.join('\n')).toEqual([])
})

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/**
 * Verifies the real customer history PDF: a statement listing every service,
 * not the old stand-in that faked a single "service" row holding only the
 * grand totals. See buildCustomerHistoryDocument in src/pdf/documents.ts.
 */

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
    try {
      parts.push(zlib.inflateSync(buf.subarray(ds, end)).toString('latin1'))
    } catch {
      /* not a deflate stream (e.g. the embedded JPEG logo) — skip it */
    }
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

test('customer history PDF lists every service, not just the totals', async ({ page }) => {
  test.setTimeout(120_000)
  fs.mkdirSync(DOWNLOADS, { recursive: true })

  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  // Seed demo data so there is a customer with more than one service.
  await page.goto(BASE + '#/settings')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expect(page.getByText('Demo data loaded')).toBeVisible({ timeout: 60000 })

  // Pick the customer with the most services directly from IndexedDB, rather
  // than depending on the seed's internal ordering staying the same.
  const target = await page.evaluate(async () => {
    const Dexie = (await import('/node_modules/dexie/dist/modern/dexie.mjs')).default
    const db = new Dexie('techcity_db')
    await db.open()
    const customers = await db.table('customers').toArray()
    const services = await db.table('services').toArray()
    let best: { id: string; name: string; code: string; count: number } | null = null
    for (const c of customers) {
      const count = services.filter((s: { customerId: string }) => s.customerId === c.id).length
      if (!best || count > best.count) best = { id: c.id, name: c.name, code: c.code, count }
    }
    return best
  })
  expect(target, 'demo data should seed at least one customer').not.toBeNull()
  expect(target!.count).toBeGreaterThanOrEqual(2)
  console.log(`✓ Using ${target!.name} (${target!.code}), ${target!.count} service(s)`)

  const serviceCodes: string[] = await page.evaluate(async (customerId) => {
    const Dexie = (await import('/node_modules/dexie/dist/modern/dexie.mjs')).default
    const db = new Dexie('techcity_db')
    await db.open()
    const services = await db.table('services').toArray()
    return services
      .filter((s: { customerId: string }) => s.customerId === customerId)
      .map((s: { code: string }) => s.code)
  }, target!.id)
  expect(serviceCodes.length).toBe(target!.count)

  await page.goto(BASE + `#/customers/${target!.id}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: target!.name, level: 1 })).toBeVisible()

  const dl = page.waitForEvent('download', { timeout: 30000 })
  await page.getByRole('button', { name: 'History', exact: true }).click()
  const download = await dl
  const p = path.join(DOWNLOADS, download.suggestedFilename())
  await download.saveAs(p)

  expect(download.suggestedFilename()).toContain(target!.code)
  console.log(`✓ Downloaded ${download.suggestedFilename()}`)

  const text = extractPdfText(fs.readFileSync(p).toString('latin1'))

  // The document identifies itself and the customer, not just a generic title.
  expect(text).toContain('CUSTOMER HISTORY STATEMENT')
  expect(text).toContain(target!.name)
  expect(text).toContain(target!.code)

  // Every service this customer has must appear as its own row — this is
  // exactly what the old fake "history" (one synthetic totals-only row)
  // could never produce.
  for (const code of serviceCodes) {
    expect(text, `PDF should list service ${code}`).toContain(code)
  }
  console.log(`✓ All ${serviceCodes.length} service code(s) present on the statement: ${serviceCodes.join(', ')}`)

  // Summary totals at the end of the statement.
  expect(text).toContain('Total Services:')
  expect(text).toContain('Total Billed:')
  expect(text).toContain('Outstanding:')
  console.log('✓ Totals summary present')
})

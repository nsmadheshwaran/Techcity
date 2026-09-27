import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:5173/'
const TMP = path.join(process.cwd(), 'test-downloads')

/**
 * Tally writes UTF-16 with a BOM, which is the format the importer has to cope
 * with, so the fixture is written the same way rather than as UTF-8.
 */
function writeTallyXml(file: string, body: string) {
  fs.mkdirSync(TMP, { recursive: true })
  const full = `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY><IMPORTDATA>
  <REQUESTDESC>
   <REPORTNAME>All Masters</REPORTNAME>
   <STATICVARIABLES><SVCURRENTCOMPANY>FIXTURE CO - (from 1-Apr-25)</SVCURRENTCOMPANY></STATICVARIABLES>
  </REQUESTDESC>
  <REQUESTDATA>${body}</REQUESTDATA>
 </IMPORTDATA></BODY>
</ENVELOPE>`
  const p = path.join(TMP, file)
  // UTF-16LE + BOM, exactly as Tally exports it.
  const buf = Buffer.from('﻿' + full, 'utf16le')
  fs.writeFileSync(p, buf)
  return p
}

function ledger(name: string, parent: string, extra = '') {
  return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${name}" RESERVEDNAME="">
    <PARENT>${parent}</PARENT>
    <STATE>Tamil Nadu</STATE>
    ${extra}
  </LEDGER></TALLYMESSAGE>`
}

const FIXTURE = [
  // A full record: phone, multi-line address, pincode, opening balance.
  ledger(
    'ACME TEXTILES &amp; CO',
    'Sundry Debtors',
    `<LEDGERMOBILE>9876500011</LEDGERMOBILE>
     <ADDRESS>12 Mill Road,</ADDRESS><ADDRESS>Gandhipuram</ADDRESS><ADDRESS>Coimbatore</ADDRESS>
     <PINCODE>641012</PINCODE>
     <OPENINGBALANCE>-2500.00</OPENINGBALANCE>
     <TAXCLASSIFICATIONNAME>&#4; Not Applicable</TAXCLASSIFICATIONNAME>`,
  ),
  // The common case in the real export: no phone at all.
  ledger(
    'NO PHONE TRADERS',
    'Sundry Debtors',
    `<ADDRESS>4 Bazaar Street</ADDRESS><ADDRESS>Tirupur</ADDRESS><PINCODE>641601</PINCODE>`,
  ),
  // Suppliers must be counted but never imported.
  ledger('SOME SUPPLIER', 'Sundry Creditors', `<LEDGERMOBILE>9000000001</LEDGERMOBILE>`),
  // Non-party ledgers must be ignored entirely.
  ledger('BANK CHARGES', 'Indirect Expenses'),
].join('\n')

test('imports the customer master from a Tally XML export', async ({ page }) => {
  test.setTimeout(120_000)
  const file = writeTallyXml('fixture-master.xml', FIXTURE)

  await page.goto(BASE + '#/settings?tab=backup')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Backup & Export' }).click()

  await expect(page.getByRole('heading', { name: 'Import from Tally' })).toBeVisible()

  // The input is hidden behind a styled button, which is what setInputFiles is for.
  await page.locator('input[type=file][accept*="xml"]').setInputFiles(file)

  // Preview must appear BEFORE anything is written.
  await expect(page.getByRole('button', { name: /Import 2 customers/ })).toBeVisible({
    timeout: 30000,
  })
  await expect(page.getByText('FIXTURE CO', { exact: false })).toBeVisible()
  console.log('✓ Preview shows 2 debtors, suppliers and expense ledgers excluded')

  await page.getByRole('button', { name: /Import 2 customers/ }).click()
  await expect(page.getByText('Tally customers imported').first()).toBeVisible({ timeout: 30000 })

  // Both land in the customer list, including the one with no phone.
  await page.goto(BASE + '#/customers')
  await page.waitForTimeout(800)
  // The list renders a desktop table AND a mobile card list, so each name is in
  // the DOM twice; scope the assertions to the table to keep them unambiguous.
  const table = page.locator('tbody')
  await expect(table.getByText('ACME TEXTILES & CO')).toBeVisible()
  await expect(table.getByText('NO PHONE TRADERS')).toBeVisible()
  await expect(page.getByText('SOME SUPPLIER')).toHaveCount(0)
  await expect(page.getByText('BANK CHARGES')).toHaveCount(0)
  console.log('✓ Debtors imported; suppliers and expense ledgers skipped')

  // The ampersand entity must be decoded, not left raw.
  const rows = await table.locator('tr').allTextContents()
  expect(rows.join(' ')).not.toContain('&amp;')

  // Re-importing the same file must not duplicate anything.
  await page.goto(BASE + '#/settings?tab=backup')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.locator('input[type=file][accept*="xml"]').setInputFiles(file)
  await page.getByRole('button', { name: /Import 2 customers/ }).click()
  await expect(page.getByText('Tally customers imported').first()).toBeVisible({ timeout: 30000 })

  await page.goto(BASE + '#/customers')
  await page.waitForTimeout(800)
  await expect(page.locator('tbody').getByText('ACME TEXTILES & CO')).toHaveCount(1)
  console.log('✓ Re-import is idempotent — no duplicates')
})

/**
 * Runs only on a machine that has the real export sitting in techcity/tally.
 * That data is private and gitignored, so this quietly skips in CI and for
 * anyone else who clones the repo.
 */
const REAL = path.join(process.cwd(), 'tally', 'Master.xml')

test('imports the real Tally master when it is present', async ({ page }) => {
  test.skip(!fs.existsSync(REAL), 'tally/Master.xml not present (private export)')
  test.setTimeout(180_000)

  await page.goto(BASE + '#/settings?tab=backup')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Backup & Export' }).click()
  await page.locator('input[type=file][accept*="xml"]').setInputFiles(REAL)

  const importBtn = page.getByRole('button', { name: /Import \d+ customers/ })
  await expect(importBtn).toBeVisible({ timeout: 60000 })
  const label = (await importBtn.textContent()) ?? ''
  const count = Number(/Import (\d+) customers/.exec(label)?.[1] ?? 0)
  expect(count).toBeGreaterThan(20)
  console.log(`✓ Real export previews ${count} customers`)

  await importBtn.click()
  await expect(page.getByText('Tally customers imported').first()).toBeVisible({ timeout: 60000 })

  const total = await page.evaluate(async () => {
    const Dexie = (await import('/node_modules/dexie/dist/modern/dexie.mjs')).default
    const db = new Dexie('techcity_db')
    await db.open()
    return db.table('customers').count()
  })
  expect(total).toBeGreaterThanOrEqual(count)
  console.log(`✓ ${total} customers in the local store after import`)
})

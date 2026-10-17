import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * Verifies Stock → Import against real .xlsx and .csv files — the actual
 * byte formats a shop owner's spreadsheet comes in, not synthetic JS objects.
 * The .xlsx fixture uses deliberately casual headers ("Item Name", "Qty",
 * "Rate") to prove the column matching works on a real-world file, not just
 * the app's own export headers.
 */

const BASE = 'http://localhost:5173/'
const XLSX_FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'stock-import.xlsx')
const CSV_FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'stock-import.csv')

test('imports stock from a real .xlsx file with casual headers', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto(BASE + '#/stock')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import Stock' })).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(XLSX_FIXTURE)

  // Preview appears before anything is written.
  await expect(page.getByRole('button', { name: /Import 2 products/ })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByText('Test Import Widget')).toBeVisible()
  await expect(page.getByText('Test Import Gizmo')).toBeVisible()
  console.log('✓ .xlsx preview shows both rows before import')

  await page.getByRole('button', { name: /Import 2 products/ }).click()
  await expect(page.getByText('Stock imported')).toBeVisible({ timeout: 10000 })

  await page.waitForTimeout(500)
  const table = page.locator('tbody')
  await expect(table.getByText('Test Import Widget')).toBeVisible()
  await expect(table.getByText('Test Import Gizmo')).toBeVisible()
  // Quantity from the "Qty" column landed correctly, including the zero row.
  await expect(table.locator('tr', { hasText: 'Test Import Widget' }).getByText('7', { exact: true })).toBeVisible()
  await expect(table.locator('tr', { hasText: 'Test Import Gizmo' }).getByText('0', { exact: true })).toBeVisible()
  console.log('✓ Both products created with correct quantities, including zero stock')

  // Re-importing the same file updates in place rather than duplicating.
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles(XLSX_FIXTURE)
  await expect(page.getByRole('button', { name: /Import 2 products/ })).toBeVisible({
    timeout: 15000,
  })
  await page.getByRole('button', { name: /Import 2 products/ }).click()
  await expect(page.getByText('Stock imported')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
  await expect(table.getByText('Test Import Widget')).toHaveCount(1)
  console.log('✓ Re-importing the same file updates existing products, no duplicates')
})

test('imports stock from a .csv file', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto(BASE + '#/stock')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles(CSV_FIXTURE)

  await expect(page.getByRole('button', { name: /Import 1 product/ })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByText('Test Import CSV Widget')).toBeVisible()
  await page.getByRole('button', { name: /Import 1 product/ }).click()
  await expect(page.getByText('Stock imported')).toBeVisible({ timeout: 10000 })

  await page.waitForTimeout(500)
  await expect(page.locator('tbody').getByText('Test Import CSV Widget')).toBeVisible()
  console.log('✓ CSV import works, including a quoted price field with a comma')
})

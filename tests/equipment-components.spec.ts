import { test, expect } from '@playwright/test'

/**
 * Verifies the equipment "components" tree: a parent device (e.g. a Desktop)
 * can have components (RAM, a hard disk…) nested under it, each with its own
 * serial number and password, and deleting the parent cascades to them.
 */

const BASE = 'http://localhost:5173/'

test('equipment components: nest under a device, reveal password, cascade delete', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')

  // A fresh customer to own the device.
  await page.goto(BASE + '#/customers')
  await page.getByRole('button', { name: 'Add Customer' }).first().click()
  await page.getByLabel('Name *').first().fill('Equipment Test Co')
  await page.getByLabel('Phone *').first().fill('9812300001')
  await page.getByRole('button', { name: 'Create Customer' }).click()
  await expect(page.getByText('Customer created')).toBeVisible({ timeout: 15000 })
  // The list page does not navigate away on save — open the new record.
  await page.getByText('Equipment Test Co').first().click()
  await expect(
    page.getByRole('heading', { name: 'Equipment Test Co', level: 1 }),
  ).toBeVisible({ timeout: 15000 })

  // Open the Equipment tab and add the parent device with a password.
  await page.getByRole('button', { name: 'Equipment', exact: false }).click()
  await page.getByRole('button', { name: 'Add Equipment' }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Equipment' })).toBeVisible()
  await page.getByLabel('Product Type').fill('Desktop')
  await page.getByLabel('Brand').fill('Dell')
  await page.getByLabel('Login / Password').fill('admin123')
  await page.getByRole('button', { name: 'Save Equipment' }).click()
  await expect(page.getByText('Equipment added')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Desktop · Dell')).toBeVisible()
  console.log('✓ Parent device created with a password')

  // Password is hidden by default and reveals on click.
  await expect(page.getByText('••••••••')).toBeVisible()
  await page.getByLabel('Show password').click()
  await expect(page.getByText('admin123')).toBeVisible()
  await page.getByLabel('Hide password').click()
  await expect(page.getByText('••••••••')).toBeVisible()
  console.log('✓ Password hidden by default, reveals and hides on click')

  // Add a component to that device.
  await page.getByLabel('Add a component to Desktop').click()
  await expect(page.getByRole('heading', { name: 'Add Component to Desktop' })).toBeVisible()
  // The parent is pre-selected — confirm, then fill in the component itself.
  await expect(page.getByLabel('Part Of')).toHaveValue(/./)
  await page.getByLabel('Product Type').fill('RAM')
  await page.getByLabel('Brand').fill('Corsair')
  await page.getByLabel('Serial Number').fill('RAM-SN-001')
  await page.getByLabel('Login / Password').fill('')
  await page.getByRole('button', { name: 'Save Equipment' }).click()
  await expect(page.getByText('Equipment added')).toBeVisible({ timeout: 10000 })
  console.log('✓ Component saved under the parent device')

  // It renders nested under the parent, with its serial number visible.
  await expect(page.getByText('RAM · Corsair')).toBeVisible()
  await expect(page.getByText('SN: RAM-SN-001')).toBeVisible()
  // A component has no "Add component" action of its own — one level deep only.
  await expect(page.getByLabel('Add a component to RAM')).toHaveCount(0)
  console.log('✓ Component nested one level deep, no further nesting offered')

  // The global equipment list annotates the component with its parent.
  await page.goto(BASE + '#/equipment')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('↳ Part of Desktop').first()).toBeVisible()
  console.log('✓ Global equipment list shows "Part of" context for the component')

  // Deleting the parent warns about the component and removes both.
  await page.goto(BASE + '#/customers')
  await page.getByRole('row', { name: /Equipment Test Co/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Equipment Test Co', level: 1 }),
  ).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Equipment', exact: false }).click()
  await page.getByRole('button', { name: 'Delete equipment' }).first().click()
  const confirmDialog = page.getByLabel('Delete equipment record?')
  await expect(confirmDialog.getByText(/and its 1 component will be removed/)).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Equipment deleted')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Desktop · Dell')).toHaveCount(0)
  await expect(page.getByText('RAM · Corsair')).toHaveCount(0)
  console.log('✓ Deleting the parent cascades to its component')
})

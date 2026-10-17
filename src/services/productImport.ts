import { db, nextCode, nowISO, uid } from '@/lib/db'
import type { Product } from '@/types'
import { parseCSV, readFileAsText } from '@/utils/csv'
import { readXLSX } from '@/utils/xlsxReader'
import { parseProductRows, type ParsedProductRow } from './productImportParse'

export * from './productImportParse'

/** Reads a .xlsx or .csv file into raw row objects, keyed by its header row. */
export async function readProductFile(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCSV(await readFileAsText(file))
  if (name.endsWith('.xlsx')) return readXLSX(file)
  throw new Error('Please choose a .xlsx or .csv file.')
}

export interface ProductImportPreview {
  products: ParsedProductRow[]
  skipped: number
  columns: Partial<Record<keyof ParsedProductRow, string>>
}

export async function previewProductImport(file: File): Promise<ProductImportPreview> {
  const rows = await readProductFile(file)
  if (!rows.length) throw new Error('That file has no data rows to import.')
  const result = parseProductRows(rows)
  if (!result.columns.name) {
    throw new Error(
      'Could not find a product name column. Expected a header like "Name", "Product" or "Item".',
    )
  }
  if (!result.products.length) {
    throw new Error('No rows had a product name — nothing to import.')
  }
  return result
}

export interface ProductImportResult {
  created: number
  updated: number
}

/**
 * Writes parsed rows into the stock table.
 *
 * Quantity is always SET to the imported value, never added to what is
 * already there — importing a spreadsheet is a stock take, and the owner's
 * file is the authoritative count at that moment. Every other field is only
 * overwritten when the imported cell actually has something in it, so a
 * partial spreadsheet (just name + quantity) cannot blank out a category,
 * brand or price the owner already entered in the app.
 *
 * Matching is by product name, case-insensitively — the app has no barcode
 * or SKU column to match on more precisely, and the name is what a shop
 * owner's own spreadsheet reliably has.
 */
export async function importProducts(rows: ParsedProductRow[]): Promise<ProductImportResult> {
  const existing = await db.products.toArray()
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]))

  let created = 0
  let updated = 0

  for (const row of rows) {
    const match = byName.get(row.name.trim().toLowerCase())
    if (match) {
      const patch: Partial<Product> = { quantity: row.quantity, updatedAt: nowISO() }
      if (row.category) patch.category = row.category
      if (row.brand) patch.brand = row.brand
      if (row.unit) patch.unit = row.unit
      if (row.costPrice !== undefined) patch.costPrice = row.costPrice
      if (row.sellPrice !== undefined) patch.sellPrice = row.sellPrice
      if (row.lowStockThreshold !== undefined) patch.lowStockThreshold = row.lowStockThreshold
      if (row.location) patch.location = row.location
      if (row.notes) patch.notes = row.notes
      const next: Product = { ...match, ...patch }
      await db.products.put(next)
      byName.set(row.name.trim().toLowerCase(), next)
      updated++
    } else {
      const code = await nextCode('product')
      const product: Product = {
        id: uid(),
        code,
        name: row.name,
        category: row.category,
        brand: row.brand,
        quantity: row.quantity,
        unit: row.unit,
        costPrice: row.costPrice,
        sellPrice: row.sellPrice,
        lowStockThreshold: row.lowStockThreshold,
        location: row.location,
        notes: row.notes,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      await db.products.add(product)
      byName.set(row.name.trim().toLowerCase(), product)
      created++
    }
  }

  return { created, updated }
}

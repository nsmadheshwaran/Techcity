/**
 * Pure parsing half of the stock importer — no database, so it can be
 * exercised directly against real spreadsheet rows without the app running.
 */

export interface ParsedProductRow {
  name: string
  category?: string
  brand?: string
  quantity: number
  unit?: string
  costPrice?: number
  sellPrice?: number
  lowStockThreshold?: number
  location?: string
  notes?: string
}

/**
 * A shop owner's own spreadsheet rarely uses the app's exact export headers,
 * so each field accepts the common things people actually type. Matched
 * case-insensitively, ignoring surrounding space.
 */
const HEADER_ALIASES: Record<keyof ParsedProductRow, string[]> = {
  name: ['name', 'product', 'product name', 'item', 'item name', 'description'],
  category: ['category', 'type', 'product type'],
  brand: ['brand', 'make', 'manufacturer'],
  quantity: ['quantity', 'qty', 'stock', 'in stock', 'count', 'balance'],
  unit: ['unit', 'uom', 'units'],
  costPrice: ['cost price', 'cost', 'purchase price', 'buy price'],
  sellPrice: ['sell price', 'selling price', 'price', 'sale price', 'mrp', 'rate'],
  lowStockThreshold: ['low stock alert', 'low stock', 'reorder level', 'minimum stock', 'min stock'],
  location: ['location', 'shelf', 'shelf / location', 'bin', 'rack'],
  notes: ['notes', 'note', 'remarks', 'description notes'],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Strips thousands separators and a currency symbol so "₹2,450.50" -> 2450.5. */
function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[₹$,\s]/g, '')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Builds a lookup from each ParsedProductRow field to the actual column name
 * present in this particular file, so mapRowToProduct() does not need to
 * repeat the alias search for every row.
 */
export function matchColumns(headers: string[]): Partial<Record<keyof ParsedProductRow, string>> {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }))
  const result: Partial<Record<keyof ParsedProductRow, string>> = {}
  for (const field of Object.keys(HEADER_ALIASES) as (keyof ParsedProductRow)[]) {
    const aliases = HEADER_ALIASES[field]
    const hit = normalized.find((h) => aliases.includes(h.norm))
    if (hit) result[field] = hit.raw
  }
  return result
}

/**
 * Converts one spreadsheet row into a product, or null when it cannot be —
 * no recognisable name column, or the name cell is blank. A row with a name
 * but no quantity is treated as zero, since "I added it but have not counted
 * it yet" is a normal state for a shop owner working through a long list.
 */
export function mapRowToProduct(
  row: Record<string, string>,
  columns: Partial<Record<keyof ParsedProductRow, string>>,
): ParsedProductRow | null {
  const get = (field: keyof ParsedProductRow) => {
    const col = columns[field]
    return col ? row[col]?.trim() : undefined
  }

  const name = get('name')
  if (!name) return null

  return {
    name,
    category: get('category') || undefined,
    brand: get('brand') || undefined,
    quantity: Math.max(0, Math.round(parseNumber(get('quantity')) ?? 0)),
    unit: get('unit') || undefined,
    costPrice: parseNumber(get('costPrice')),
    sellPrice: parseNumber(get('sellPrice')),
    lowStockThreshold: parseNumber(get('lowStockThreshold')),
    location: get('location') || undefined,
    notes: get('notes') || undefined,
  }
}

/** Runs matchColumns() + mapRowToProduct() over every row from a parsed file. */
export function parseProductRows(rows: Record<string, string>[]): {
  products: ParsedProductRow[]
  skipped: number
  columns: Partial<Record<keyof ParsedProductRow, string>>
} {
  const headers = rows.length ? Object.keys(rows[0]) : []
  const columns = matchColumns(headers)
  const products: ParsedProductRow[] = []
  let skipped = 0
  for (const row of rows) {
    const p = mapRowToProduct(row, columns)
    if (p) products.push(p)
    else skipped++
  }
  return { products, skipped, columns }
}

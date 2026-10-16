import { db, nextCode, nowISO, uid } from '@/lib/db'
import type { Product } from '@/types'

export type ProductDraft = Omit<Product, 'id' | 'code' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Product, 'isDemo'>>

export async function createProduct(draft: ProductDraft): Promise<Product> {
  const code = await nextCode('product')
  const row: Product = {
    ...draft,
    id: uid(),
    code,
    quantity: Number.isFinite(draft.quantity) ? draft.quantity : 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.products.add(row)
  return row
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  const existing = await db.products.get(id)
  if (!existing) throw new Error('Product not found. It may have been deleted.')
  const updated: Product = { ...existing, ...patch, id, updatedAt: nowISO() }
  await db.products.put(updated)
  return updated
}

export async function deleteProduct(id: string) {
  await db.products.delete(id)
}

/**
 * Adds (positive) or removes (negative) stock without the caller needing to
 * read-modify-write the row — the common case of "+1 arrived" or "-1 used on
 * a job" from the list view. Quantity is clamped at zero: stock never goes
 * negative, since a negative count on the shelf has no real meaning.
 */
export async function adjustStock(id: string, delta: number): Promise<Product> {
  const existing = await db.products.get(id)
  if (!existing) throw new Error('Product not found. It may have been deleted.')
  const quantity = Math.max(0, (existing.quantity ?? 0) + delta)
  const updated: Product = { ...existing, quantity, updatedAt: nowISO() }
  await db.products.put(updated)
  return updated
}

export function searchProducts<T extends Product>(products: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter((p) =>
    [p.name, p.code, p.category, p.brand, p.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

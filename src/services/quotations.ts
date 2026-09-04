import { db, nextCode, nowISO, uid } from '@/lib/db'
import { round2 } from '@/services/services'
import type { Quotation, QuotationItem, QuotationStatus } from '@/types'
import { todayISO } from '@/utils/format'

export interface QuotationItemDraft {
  name: string
  quantity: number
  unitPrice: number
}

export interface QuotationDraft {
  customerId: string
  date?: string
  validUntil?: string
  status?: QuotationStatus
  items?: QuotationItemDraft[]
  discount?: number
  taxPercent?: number
  notes?: string
}

export interface QuotationTotals {
  subtotal: number
  taxAmount: number
  totalAmount: number
}

/** Gross item total − discount, then GST added on top. */
export function computeQuotationTotals(
  items: QuotationItemDraft[],
  discount: number,
  taxPercent: number,
): QuotationTotals {
  const gross = round2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0))
  const subtotal = round2(Math.max(0, gross - (Number(discount) || 0)))
  const taxAmount = round2((subtotal * (Number(taxPercent) || 0)) / 100)
  const totalAmount = round2(subtotal + taxAmount)
  return { subtotal, taxAmount, totalAmount }
}

function buildItems(items: QuotationItemDraft[]): QuotationItem[] {
  return items
    .filter((i) => i.name.trim())
    .map((i) => {
      const quantity = Number(i.quantity) || 1
      const unitPrice = round2(i.unitPrice)
      return {
        id: uid(),
        name: i.name.trim(),
        quantity,
        unitPrice,
        amount: round2(quantity * unitPrice),
      }
    })
}

export async function createQuotation(draft: QuotationDraft): Promise<Quotation> {
  const customer = await db.customers.get(draft.customerId)
  if (!customer) throw new Error('Selected customer no longer exists. Please choose a customer.')
  const items = buildItems(draft.items ?? [])
  if (!items.length) throw new Error('Add at least one item to the quotation.')

  const code = await nextCode('quotation')
  const discount = round2(draft.discount ?? 0)
  const taxPercent = round2(draft.taxPercent ?? 0)
  const totals = computeQuotationTotals(items, discount, taxPercent)

  const quotation: Quotation = {
    id: uid(),
    code,
    customerId: draft.customerId,
    date: draft.date || todayISO(),
    validUntil: draft.validUntil || undefined,
    status: draft.status ?? 'Draft',
    items,
    discount,
    taxPercent,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    notes: draft.notes?.trim() || undefined,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.quotations.add(quotation)
  return quotation
}

export async function updateQuotation(
  id: string,
  draft: QuotationDraft,
): Promise<Quotation> {
  const existing = await db.quotations.get(id)
  if (!existing) throw new Error('Quotation not found. It may have been deleted.')
  const customer = await db.customers.get(draft.customerId)
  if (!customer) throw new Error('Selected customer no longer exists. Please choose a customer.')

  const items = buildItems(draft.items ?? existing.items ?? [])
  if (!items.length) throw new Error('Add at least one item to the quotation.')

  const discount = round2(draft.discount ?? existing.discount ?? 0)
  const taxPercent = round2(draft.taxPercent ?? existing.taxPercent ?? 0)
  const totals = computeQuotationTotals(items, discount, taxPercent)

  const updated: Quotation = {
    ...existing,
    customerId: draft.customerId,
    date: draft.date || existing.date,
    validUntil: draft.validUntil === undefined ? existing.validUntil : draft.validUntil || undefined,
    status: draft.status ?? existing.status,
    items,
    discount,
    taxPercent,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    notes: draft.notes === undefined ? existing.notes : draft.notes?.trim() || undefined,
    updatedAt: nowISO(),
  }
  await db.quotations.put(updated)
  return updated
}

export async function deleteQuotation(id: string) {
  await db.quotations.delete(id)
}

export async function getQuotation(id: string) {
  return db.quotations.get(id)
}

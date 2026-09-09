import { db, nowISO, uid } from '@/lib/db'
import type { Expense } from '@/types'
import { round2 } from '@/services/services'
import { todayISO } from '@/utils/format'

export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Expense, 'isDemo'>>

/** Input for create/update — money fields arrive as strings from the form. */
export interface ExpenseInput {
  date?: string
  type?: 'expense' | 'income'
  category?: string
  title?: string
  amount?: number | string
  serviceId?: string
  customerId?: string
  notes?: string
}

function normalize(input: ExpenseInput, existing?: Expense) {
  const title = (input.title ?? existing?.title ?? '').trim()
  if (!title) throw new Error('A short title is required (e.g. “Diesel for site visit”).')
  const amount = round2(Number(input.amount ?? existing?.amount ?? 0))
  if (!(amount > 0)) throw new Error('Amount must be greater than zero.')
  const category = (input.category ?? existing?.category ?? 'Other').trim() || 'Other'
  return {
    date: input.date || existing?.date || todayISO(),
    type: (input.type ?? existing?.type ?? 'expense') === 'income' ? ('income' as const) : ('expense' as const),
    category,
    title,
    amount,
    serviceId: input.serviceId === undefined ? existing?.serviceId : input.serviceId || undefined,
    customerId: input.customerId === undefined ? existing?.customerId : input.customerId || undefined,
    notes: input.notes === undefined ? existing?.notes : input.notes?.trim() || undefined,
  }
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const expense: Expense = {
    id: uid(),
    ...normalize(input),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.expenses.add(expense)
  return expense
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  const existing = await db.expenses.get(id)
  if (!existing) throw new Error('Expense not found. It may have been deleted.')
  const updated: Expense = {
    ...existing,
    ...normalize(input, existing),
    updatedAt: nowISO(),
  }
  await db.expenses.put(updated)
  return updated
}

export async function deleteExpense(id: string) {
  await db.expenses.delete(id)
}

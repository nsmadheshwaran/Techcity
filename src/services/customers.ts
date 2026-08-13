import { db, nextCode, nowISO, uid } from '@/lib/db'
import type { Customer, CustomerStats, Service } from '@/types'
import { todayISO } from '@/utils/format'

export type CustomerDraft = Omit<Customer, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'dateAdded'> &
  Partial<Pick<Customer, 'dateAdded' | 'isDemo'>>

/** Returns the existing customer with the same phone number, if any. */
export async function findByPhone(phone: string, excludeId?: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return undefined
  const all = await db.customers.toArray()
  return all.find(
    (c) =>
      c.id !== excludeId &&
      (c.phone.replace(/\D/g, '').slice(-10) === digits ||
        (c.altPhone ?? '').replace(/\D/g, '').slice(-10) === digits),
  )
}

export async function createCustomer(draft: CustomerDraft): Promise<Customer> {
  const duplicate = await findByPhone(draft.phone)
  if (duplicate) {
    throw new Error(
      `A customer with this phone number already exists: ${duplicate.name} (${duplicate.code})`,
    )
  }
  const code = await nextCode('customer')
  const customer: Customer = {
    ...draft,
    id: uid(),
    code,
    dateAdded: draft.dateAdded ?? todayISO(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.customers.add(customer)
  return customer
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer> {
  const existing = await db.customers.get(id)
  if (!existing) throw new Error('Customer not found. It may have been deleted.')
  if (patch.phone && patch.phone !== existing.phone) {
    const duplicate = await findByPhone(patch.phone, id)
    if (duplicate)
      throw new Error(`Another customer already uses this phone number: ${duplicate.name}`)
  }
  const updated: Customer = { ...existing, ...patch, id, updatedAt: nowISO() }
  await db.customers.put(updated)
  return updated
}

/** Deletes a customer together with all of their related records (cascade). */
export async function deleteCustomer(id: string) {
  await db.transaction(
    'rw',
    [db.customers, db.customerContacts, db.services, db.serviceParts, db.payments, db.equipment, db.reminders],
    async () => {
      await db.customerContacts.where('customerId').equals(id).delete()
      const services = await db.services.where('customerId').equals(id).toArray()
      const serviceIds = services.map((s) => s.id)
      for (const sid of serviceIds) {
        await db.serviceParts.where('serviceId').equals(sid).delete()
      }
      await db.payments.where('customerId').equals(id).delete()
      await db.services.where('customerId').equals(id).delete()
      await db.equipment.where('customerId').equals(id).delete()
      await db.reminders.where('customerId').equals(id).delete()
      await db.customers.delete(id)
    },
  )
}

export async function getCustomer(id: string) {
  return db.customers.get(id)
}

/** Fast in-memory search across name / phone / code / email / city. */
export function searchCustomers<T extends Customer>(customers: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return customers
  const digits = q.replace(/\D/g, '')
  return customers.filter((c) => {
    if (c.name.toLowerCase().includes(q)) return true
    if (c.code.toLowerCase().includes(q)) return true
    if ((c.email ?? '').toLowerCase().includes(q)) return true
    if ((c.city ?? '').toLowerCase().includes(q)) return true
    if (digits.length >= 3) {
      if (c.phone.replace(/\D/g, '').includes(digits)) return true
      if ((c.altPhone ?? '').replace(/\D/g, '').includes(digits)) return true
    }
    return false
  })
}

/** Aggregate a customer's service/payment figures. Pure function — no DB access. */
export function computeStats(services: Service[]): CustomerStats {
  const billable = services.filter((s) => s.status !== 'Cancelled')
  const totalSpent = billable.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
  const totalPaid = billable.reduce((sum, s) => sum + (s.amountPaid || 0), 0)
  const sortedByDate = [...billable].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
  const today = todayISO()
  const upcoming = billable
    .map((s) => s.nextServiceDate)
    .filter((d): d is string => Boolean(d) && d! >= today)
    .sort()
  return {
    totalServices: billable.length,
    totalSpent,
    totalPaid,
    outstanding: Math.max(0, totalSpent - totalPaid),
    lastServiceDate: sortedByDate[0]?.serviceDate,
    nextServiceDate: upcoming[0],
  }
}

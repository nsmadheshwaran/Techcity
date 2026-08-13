import { db, nowISO, sortContacts, uid } from '@/lib/db'
import type { CustomerContact } from '@/types'

export type ContactDraft = Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt' | 'position'> &
  Partial<Pick<CustomerContact, 'isDemo'>>

/**
 * Replaces the full contact list for a customer inside one transaction.
 * `contacts` is the live UI array — its order is preserved as `position`.
 */
export async function saveContactsFor(customerId: string, contacts: ContactDraft[]) {
  await db.transaction('rw', db.customerContacts, async () => {
    await db.customerContacts.where('customerId').equals(customerId).delete()
    const rows: CustomerContact[] = contacts
      .filter((c) => c.name.trim() || c.phone.trim())
      .map((c, position) => ({
        id: uid(),
        customerId,
        position,
        name: c.name.trim(),
        phone: c.phone.trim(),
        role: c.role?.trim() || undefined,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }))
    if (rows.length) await db.customerContacts.bulkAdd(rows)
  })
  return getContactsFor(customerId)
}

export async function getContactsFor(customerId: string): Promise<CustomerContact[]> {
  const rows = await db.customerContacts.where('customerId').equals(customerId).toArray()
  return sortContacts(rows)
}

export async function deleteContactsFor(customerId: string) {
  await db.customerContacts.where('customerId').equals(customerId).delete()
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, DEFAULT_SETTINGS, sortContacts, sortParts } from '@/lib/db'
import type {
  Customer,
  CustomerContact,
  CustomerWithStats,
  Quotation,
  Service,
  ServicePart,
} from '@/types'
import { computeStats } from '@/services/customers'

/**
 * Live queries backed by IndexedDB. Every component that uses these re-renders
 * automatically whenever the underlying table changes — no manual refetching.
 */

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.get('business'), [])
  // Memoised so the returned object identity is stable between renders —
  // components can safely use it inside useEffect dependency arrays.
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...(settings ?? {}) }), [settings])
}

/**
 * Same as useSettings but also reports whether the saved row has actually been
 * read from IndexedDB. Forms use this so they never apply the built-in defaults
 * over the business's own saved defaults during the first render.
 */
export function useSettingsWithStatus() {
  const settings = useLiveQuery(() => db.settings.get('business'), [])
  return useMemo(
    () => ({ settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) }, loaded: settings !== undefined }),
    [settings],
  )
}

export function useCustomers() {
  return useLiveQuery(() => db.customers.orderBy('createdAt').reverse().toArray(), [])
}

export function useCustomer(id?: string) {
  return useLiveQuery(async () => (id ? db.customers.get(id) : undefined), [id])
}

export function useServices() {
  return useLiveQuery(() => db.services.orderBy('serviceDate').reverse().toArray(), [])
}

export function useService(id?: string) {
  return useLiveQuery(async () => (id ? db.services.get(id) : undefined), [id])
}

export function useCustomerServices(customerId?: string) {
  return useLiveQuery(async () => {
    if (!customerId) return [] as Service[]
    const rows = await db.services.where('customerId').equals(customerId).toArray()
    return rows.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
  }, [customerId])
}

export function useCustomerContacts(customerId?: string) {
  return useLiveQuery(async () => {
    if (!customerId) return [] as CustomerContact[]
    return sortContacts(await db.customerContacts.where('customerId').equals(customerId).toArray())
  }, [customerId])
}

export function useServiceParts(serviceId?: string) {
  return useLiveQuery(async () => {
    if (!serviceId) return []
    // IndexedDB returns rows in key order, so restore the original entry order.
    return sortParts(await db.serviceParts.where('serviceId').equals(serviceId).toArray())
  }, [serviceId])
}

export function usePayments(filter?: { serviceId?: string; customerId?: string }) {
  const serviceId = filter?.serviceId
  const customerId = filter?.customerId
  return useLiveQuery(async () => {
    let rows
    if (serviceId) rows = await db.payments.where('serviceId').equals(serviceId).toArray()
    else if (customerId) rows = await db.payments.where('customerId').equals(customerId).toArray()
    else rows = await db.payments.toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [serviceId, customerId])
}

export function useEquipment(customerId?: string) {
  return useLiveQuery(async () => {
    const rows = customerId
      ? await db.equipment.where('customerId').equals(customerId).toArray()
      : await db.equipment.toArray()
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [customerId])
}

export function useReminders(customerId?: string) {
  return useLiveQuery(async () => {
    const rows = customerId
      ? await db.reminders.where('customerId').equals(customerId).toArray()
      : await db.reminders.toArray()
    return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [customerId])
}

export function useCalls(customerId?: string) {
  return useLiveQuery(async () => {
    const rows = customerId
      ? await db.calls.where('customerId').equals(customerId).toArray()
      : await db.calls.toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [customerId])
}

export function useQuotations() {
  return useLiveQuery(() => db.quotations.orderBy('date').reverse().toArray(), [])
}

export function useQuotation(id?: string) {
  return useLiveQuery(async () => (id ? db.quotations.get(id) : undefined), [id])
}

/**
 * Parts for a set of services, keyed by service id — used to roll up the
 * shop's internal buy-vs-sell profit per customer.
 */
export function useServicePartsForServiceIds(
  serviceIds: string[],
): Map<string, ServicePart[]> | undefined {
  const key = serviceIds.join('|')
  return useLiveQuery(async () => {
    const ids = key ? key.split('|') : []
    if (!ids.length) return new Map<string, ServicePart[]>()
    const rows = await db.serviceParts.where('serviceId').anyOf(ids).toArray()
    const map = new Map<string, ServicePart[]>()
    for (const r of rows) {
      const list = map.get(r.serviceId)
      if (list) list.push(r)
      else map.set(r.serviceId, [r])
    }
    // Preserve entry order within each service.
    for (const list of map.values()) sortParts(list)
    return map
  }, [key])
}

/** Quotations joined with their customer for list views. */
export function useQuotationsWithCustomer(): (Quotation & { customer?: Customer })[] | undefined {
  const quotations = useQuotations()
  const customers = useCustomers()
  return useMemo(() => {
    if (!quotations || !customers) return undefined
    const map = new Map(customers.map((c) => [c.id, c]))
    return quotations.map((q) => ({ ...q, customer: map.get(q.customerId) }))
  }, [quotations, customers])
}

/** Customers joined with their aggregated service/payment figures. */
export function useCustomersWithStats(): CustomerWithStats[] | undefined {
  const customers = useCustomers()
  const services = useServices()
  return useMemo(() => {
    if (!customers || !services) return undefined
    const byCustomer = new Map<string, Service[]>()
    for (const s of services) {
      const list = byCustomer.get(s.customerId)
      if (list) list.push(s)
      else byCustomer.set(s.customerId, [s])
    }
    return customers.map((c) => ({ ...c, stats: computeStats(byCustomer.get(c.id) ?? []) }))
  }, [customers, services])
}

export function useCustomerMap(): Map<string, Customer> {
  const customers = useCustomers()
  return useMemo(() => new Map((customers ?? []).map((c) => [c.id, c])), [customers])
}

/** Distinct technician names already used — powers the technician autocomplete. */
export function useTechnicians(): string[] {
  const services = useServices()
  return useMemo(() => {
    const set = new Set<string>()
    for (const s of services ?? []) if (s.technician?.trim()) set.add(s.technician.trim())
    return [...set].sort()
  }, [services])
}

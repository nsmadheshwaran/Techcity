import { db, nextCode, nowISO, uid } from '@/lib/db'
import type { Payment, Service, ServicePart, PaymentStatus } from '@/types'
import { todayISO, warrantyExpiryFrom } from '@/utils/format'

export interface Money {
  serviceCharge: number
  partsCost: number
  discount: number
  taxPercent: number
  amountPaid: number
}

export interface Totals {
  subtotal: number
  taxAmount: number
  totalAmount: number
  balance: number
  paymentStatus: PaymentStatus
}

/** Total = (service charge + parts cost - discount) + tax. Balance = total - paid. */
export function computeTotals(m: Money): Totals {
  const gross = round2((m.serviceCharge || 0) + (m.partsCost || 0))
  const subtotal = round2(Math.max(0, gross - (m.discount || 0)))
  const taxAmount = round2((subtotal * (m.taxPercent || 0)) / 100)
  const totalAmount = round2(subtotal + taxAmount)
  const balance = round2(totalAmount - (m.amountPaid || 0))
  const paid = m.amountPaid || 0
  const paymentStatus: PaymentStatus =
    totalAmount <= 0 ? 'Paid' : paid <= 0 ? 'Pending' : paid + 0.001 >= totalAmount ? 'Paid' : 'Partially Paid'
  return { subtotal, taxAmount, totalAmount, balance, paymentStatus }
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export interface PartDraft {
  id?: string
  name: string
  quantity: number
  unitPrice: number
  /** Internal cost per unit (what the shop paid) — never printed on customer documents. */
  costPrice?: number
}

export type ServiceDraft = Omit<
  Service,
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'totalAmount' | 'balance' | 'paymentStatus'
> &
  Partial<Pick<Service, 'totalAmount' | 'balance' | 'paymentStatus' | 'isDemo'>>

/**
 * Creates a service + its parts + an initial payment row (if any amount was paid)
 * + follow-up reminders, all inside one transaction.
 */
export async function createService(draft: ServiceDraft, parts: PartDraft[] = []): Promise<Service> {
  const customer = await db.customers.get(draft.customerId)
  if (!customer) throw new Error('Selected customer no longer exists. Please choose a customer.')

  const code = await nextCode('service')
  const totals = computeTotals(draft)
  const warrantyExpiry =
    draft.warrantyExpiry || warrantyExpiryFrom(draft.serviceDate, draft.warrantyPeriod)

  const service: Service = {
    ...draft,
    id: uid(),
    code,
    warrantyExpiry,
    totalAmount: totals.totalAmount,
    balance: totals.balance,
    paymentStatus: totals.paymentStatus,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }

  await db.transaction('rw', db.services, db.serviceParts, db.payments, db.reminders, async () => {
    await db.services.add(service)
    await savePartsFor(service.id, parts, Boolean(draft.isDemo))
    if ((draft.amountPaid || 0) > 0) {
      const payment: Payment = {
        id: uid(),
        serviceId: service.id,
        customerId: service.customerId,
        date: service.serviceDate,
        amount: round2(draft.amountPaid),
        method: service.paymentMethod ?? 'Cash',
        note: 'Initial payment recorded with service',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        isDemo: draft.isDemo,
      }
      await db.payments.add(payment)
    }
    await syncReminders(service)
  })

  return service
}

export async function updateService(
  id: string,
  patch: Partial<Service>,
  parts?: PartDraft[],
): Promise<Service> {
  const existing = await db.services.get(id)
  if (!existing) throw new Error('Service not found. It may have been deleted.')

  const merged = { ...existing, ...patch } as Service
  const totals = computeTotals(merged)
  const warrantyExpiry =
    patch.warrantyExpiry !== undefined
      ? patch.warrantyExpiry
      : warrantyExpiryFrom(merged.serviceDate, merged.warrantyPeriod) ?? existing.warrantyExpiry

  const updated: Service = {
    ...merged,
    id,
    warrantyExpiry,
    totalAmount: totals.totalAmount,
    balance: totals.balance,
    paymentStatus: totals.paymentStatus,
    updatedAt: nowISO(),
  }

  await db.transaction('rw', db.services, db.serviceParts, db.reminders, async () => {
    await db.services.put(updated)
    if (parts) await savePartsFor(id, parts, Boolean(existing.isDemo))
    await syncReminders(updated)
  })
  return updated
}

export async function deleteService(id: string) {
  await db.transaction('rw', db.services, db.serviceParts, db.payments, db.reminders, async () => {
    await db.serviceParts.where('serviceId').equals(id).delete()
    await db.payments.where('serviceId').equals(id).delete()
    await db.reminders.where('serviceId').equals(id).delete()
    await db.services.delete(id)
  })
}

async function savePartsFor(serviceId: string, parts: PartDraft[], isDemo: boolean) {
  await db.serviceParts.where('serviceId').equals(serviceId).delete()
  const rows: ServicePart[] = parts
    .filter((p) => p.name.trim())
    .map((p, index) => ({
      id: p.id ?? uid(),
      serviceId,
      position: index,
      name: p.name.trim(),
      quantity: Number(p.quantity) || 1,
      unitPrice: round2(p.unitPrice),
      total: round2((Number(p.quantity) || 1) * (Number(p.unitPrice) || 0)),
      costPrice: p.costPrice !== undefined && p.costPrice !== null && Number(p.costPrice) > 0
        ? round2(Number(p.costPrice))
        : undefined,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      isDemo,
    }))
  if (rows.length) await db.serviceParts.bulkAdd(rows)
}

/** Keeps auto reminders (next service + warranty) in sync with the service record. */
async function syncReminders(service: Service) {
  await db.reminders
    .where('serviceId')
    .equals(service.id)
    .filter((r) => r.type === 'Next Service' || r.type === 'Warranty')
    .delete()

  const rows = []
  if (service.nextServiceDate && service.status !== 'Cancelled') {
    rows.push({
      id: uid(),
      customerId: service.customerId,
      serviceId: service.id,
      type: 'Next Service' as const,
      title: `${service.serviceType} — next service due`,
      dueDate: service.nextServiceDate,
      done: false,
      notes: `Service ${service.code}`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      isDemo: service.isDemo,
    })
  }
  if (service.warrantyExpiry && service.status !== 'Cancelled') {
    rows.push({
      id: uid(),
      customerId: service.customerId,
      serviceId: service.id,
      type: 'Warranty' as const,
      title: `${service.serviceType} warranty expiring`,
      dueDate: service.warrantyExpiry,
      done: false,
      notes: `Service ${service.code} — ${service.warrantyPeriod ?? ''}`.trim(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      isDemo: service.isDemo,
    })
  }
  if (rows.length) await db.reminders.bulkAdd(rows)
}

/** Records an additional payment against a service and refreshes its balance. */
export async function addPayment(input: {
  serviceId: string
  amount: number
  method: Payment['method']
  date?: string
  note?: string
  allowOverpay?: boolean
}) {
  const service = await db.services.get(input.serviceId)
  if (!service) throw new Error('Service not found.')
  const amount = round2(input.amount)
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.')
  if (!input.allowOverpay && amount > service.balance + 0.001)
    throw new Error(
      `Payment exceeds the pending balance (₹${service.balance.toLocaleString('en-IN')}).`,
    )

  const payment: Payment = {
    id: uid(),
    serviceId: service.id,
    customerId: service.customerId,
    date: input.date ?? todayISO(),
    amount,
    method: input.method,
    note: input.note,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }

  await db.transaction('rw', db.services, db.payments, async () => {
    await db.payments.add(payment)
    const paid = round2((service.amountPaid || 0) + amount)
    const totals = computeTotals({ ...service, amountPaid: paid })
    await db.services.put({
      ...service,
      amountPaid: paid,
      paymentMethod: input.method,
      balance: totals.balance,
      paymentStatus: totals.paymentStatus,
      updatedAt: nowISO(),
    })
  })
  return payment
}

export async function deletePayment(id: string) {
  const payment = await db.payments.get(id)
  if (!payment) throw new Error('Payment not found.')
  await db.transaction('rw', db.services, db.payments, async () => {
    await db.payments.delete(id)
    const service = await db.services.get(payment.serviceId)
    if (service) {
      const paid = Math.max(0, round2((service.amountPaid || 0) - payment.amount))
      const totals = computeTotals({ ...service, amountPaid: paid })
      await db.services.put({
        ...service,
        amountPaid: paid,
        balance: totals.balance,
        paymentStatus: totals.paymentStatus,
        updatedAt: nowISO(),
      })
    }
  })
}

export async function setServiceStatus(id: string, status: Service['status']) {
  return updateService(id, { status })
}

import { db, getSettings, sortParts } from '@/lib/db'
import type { CustomerContact } from '@/types'
import type { Customer, Equipment, Payment, Reminder, Service, ServicePart } from '@/types'
import { downloadCSV, downloadJSON, timestampSuffix } from '@/utils/csv'

export interface BackupFile {
  app: 'tech-city-technology'
  version: 1
  exportedAt: string
  data: {
    customers: Customer[]
    services: Service[]
    serviceParts: ServicePart[]
    payments: Payment[]
    equipment: Equipment[]
    reminders: Reminder[]
    customerContacts: CustomerContact[]
    settings: unknown[]
    counters: { key: string; value: number }[]
  }
}

export async function buildBackup(): Promise<BackupFile> {
  const [customers, services, serviceParts, payments, equipment, reminders, customerContacts, settings, counters] =
    await Promise.all([
      db.customers.toArray(),
      db.services.toArray(),
      db.serviceParts.toArray(),
      db.payments.toArray(),
      db.equipment.toArray(),
      db.reminders.toArray(),
      db.customerContacts.toArray(),
      db.settings.toArray(),
      db.counters.toArray(),
    ])
  return {
    app: 'tech-city-technology',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { customers, services, serviceParts, payments, equipment, reminders, customerContacts, settings, counters },
  }
}

export async function exportBackupJSON() {
  const backup = await buildBackup()
  downloadJSON(backup, `techcity-backup-${timestampSuffix()}.json`)
  return backup
}

/** Replaces the entire database with the contents of a backup file. */
export async function restoreBackup(raw: string) {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON. Please select a Tech City backup file.')
  }
  if (parsed?.app !== 'tech-city-technology' || !parsed.data)
    throw new Error('This does not look like a Tech City Technology backup file.')

  const d = parsed.data
  await db.transaction(
    'rw',
    [
      db.customers,
      db.services,
      db.serviceParts,
      db.payments,
      db.equipment,
      db.reminders,
      db.customerContacts,
      db.settings,
      db.counters,
    ],
    async () => {
      await Promise.all([
        db.customers.clear(),
        db.services.clear(),
        db.serviceParts.clear(),
        db.payments.clear(),
        db.equipment.clear(),
        db.reminders.clear(),
        db.customerContacts.clear(),
        db.counters.clear(),
      ])
      if (d.customers?.length) await db.customers.bulkAdd(d.customers)
      if (d.services?.length) await db.services.bulkAdd(d.services)
      if (d.serviceParts?.length) await db.serviceParts.bulkAdd(d.serviceParts)
      if (d.payments?.length) await db.payments.bulkAdd(d.payments)
      if (d.equipment?.length) await db.equipment.bulkAdd(d.equipment)
      if (d.reminders?.length) await db.reminders.bulkAdd(d.reminders)
      if (d.customerContacts?.length) await db.customerContacts.bulkAdd(d.customerContacts)
      if (d.counters?.length) await db.counters.bulkAdd(d.counters)
      if (d.settings?.length)
        await db.settings.bulkPut(d.settings as Awaited<ReturnType<typeof getSettings>>[])
    },
  )
  return {
    customers: d.customers?.length ?? 0,
    services: d.services?.length ?? 0,
  }
}

export async function exportCustomersCSV() {
  const customers = await db.customers.orderBy('code').toArray()
  const services = await db.services.toArray()
  const rows = customers.map((c) => {
    const own = services.filter((s) => s.customerId === c.id && s.status !== 'Cancelled')
    const total = own.reduce((s, x) => s + x.totalAmount, 0)
    const paid = own.reduce((s, x) => s + x.amountPaid, 0)
    return {
      'Customer ID': c.code,
      Name: c.name,
      Phone: c.phone,
      'Alternate Phone': c.altPhone ?? '',
      Email: c.email ?? '',
      'GST Number': c.gstNumber ?? '',
      Address: c.address ?? '',
      City: c.city ?? '',
      Pincode: c.pincode ?? '',
      'Date Added': c.dateAdded,
      'Total Services': own.length,
      'Total Amount': total.toFixed(2),
      'Amount Paid': paid.toFixed(2),
      Outstanding: Math.max(0, total - paid).toFixed(2),
      Notes: c.notes ?? '',
    }
  })
  downloadCSV(rows, `techcity-customers-${timestampSuffix()}.csv`)
  return rows.length
}

export async function exportServicesCSV() {
  const [services, customers, parts] = await Promise.all([
    db.services.toArray(),
    db.customers.toArray(),
    db.serviceParts.toArray(),
  ])
  const byId = new Map(customers.map((c) => [c.id, c]))
  const rows = services
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
    .map((s) => {
      const c = byId.get(s.customerId)
      const own = sortParts(parts.filter((p) => p.serviceId === s.id))
      return {
        'Service ID': s.code,
        Date: s.serviceDate,
        'Customer ID': c?.code ?? '',
        Customer: c?.name ?? '',
        Phone: c?.phone ?? '',
        'Service Type': s.serviceType,
        Status: s.status,
        'Service Mode': s.serviceMode ?? 'Offline',
        Product: s.product ?? '',
        Brand: s.brand ?? '',
        Model: s.model ?? '',
        'Serial Number': s.serialNumber ?? '',
        Complaint: s.complaint,
        Diagnosis: s.diagnosis ?? '',
        'Work Performed': s.workPerformed ?? '',
        'Parts Replaced': own.map((p) => `${p.name} x${p.quantity}`).join('; '),
        Technician: s.technician ?? '',
        'Service Charge': s.serviceCharge.toFixed(2),
        'Parts Cost': s.partsCost.toFixed(2),
        Discount: s.discount.toFixed(2),
        'Tax %': s.taxPercent ?? 0,
        Total: s.totalAmount.toFixed(2),
        'Amount Paid': s.amountPaid.toFixed(2),
        Balance: s.balance.toFixed(2),
        'Payment Status': s.paymentStatus,
        'Payment Method': s.paymentMethod ?? '',
        'Warranty Period': s.warrantyPeriod ?? '',
        'Warranty Expiry': s.warrantyExpiry ?? '',
        'Next Service Date': s.nextServiceDate ?? '',
        Notes: s.notes ?? '',
      }
    })
  downloadCSV(rows, `techcity-services-${timestampSuffix()}.csv`)
  return rows.length
}

export async function exportPaymentsCSV() {
  const [payments, customers, services] = await Promise.all([
    db.payments.toArray(),
    db.customers.toArray(),
    db.services.toArray(),
  ])
  const cById = new Map(customers.map((c) => [c.id, c]))
  const sById = new Map(services.map((s) => [s.id, s]))
  const rows = payments
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) => ({
      Date: p.date,
      'Service ID': sById.get(p.serviceId)?.code ?? '',
      Customer: cById.get(p.customerId)?.name ?? '',
      Phone: cById.get(p.customerId)?.phone ?? '',
      Amount: p.amount.toFixed(2),
      Method: p.method,
      Note: p.note ?? '',
    }))
  downloadCSV(rows, `techcity-payments-${timestampSuffix()}.csv`)
  return rows.length
}

export async function exportEquipmentCSV() {
  const [equipment, customers] = await Promise.all([db.equipment.toArray(), db.customers.toArray()])
  const byId = new Map(customers.map((c) => [c.id, c]))
  const rows = equipment.map((e) => ({
    'Product ID': e.code,
    Customer: byId.get(e.customerId)?.name ?? '',
    Phone: byId.get(e.customerId)?.phone ?? '',
    'Product Type': e.productType,
    Brand: e.brand ?? '',
    Model: e.model ?? '',
    'Serial Number': e.serialNumber ?? '',
    'Installation Date': e.installationDate ?? '',
    Warranty: e.warrantyPeriod ?? '',
    'Warranty Expiry': e.warrantyExpiry ?? '',
    Location: e.location ?? '',
    Status: e.status,
    Notes: e.notes ?? '',
  }))
  downloadCSV(rows, `techcity-equipment-${timestampSuffix()}.csv`)
  return rows.length
}

/** Wipes every business record (used by Settings → Danger zone). */
export async function wipeAllData() {
  await Promise.all([
    db.customers.clear(),
    db.services.clear(),
    db.serviceParts.clear(),
    db.payments.clear(),
    db.equipment.clear(),
    db.reminders.clear(),
    db.counters.clear(),
  ])
}

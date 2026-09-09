import Dexie, { type Table } from 'dexie'
import type {
  AppUser,
  BusinessSettings,
  Call,
  Customer,
  CustomerContact,
  Equipment,
  Expense,
  Payment,
  Quotation,
  Reminder,
  Service,
  ServicePart,
  ServiceVisit,
} from '@/types'

/**
 * Local-first relational database (IndexedDB via Dexie).
 *
 * Tables mirror the SQL schema in `supabase/schema.sql` one-to-one, so the app can be
 * migrated to Supabase/Postgres without changing the domain model.
 *   *   customers 1─┬─* services ─┬─* service_parts
   *               │             └─* payments
   *               ├─* equipment
   *               ├─* calls
   *               ├─* quotations
   *               └─* reminders
 *
 * Data is stored in the browser's IndexedDB, which persists across refreshes,
 * restarts and offline use. Use Settings → Backup to export/import JSON + CSV.
 */
export class TechCityDB extends Dexie {
  customers!: Table<Customer, string>
  customerContacts!: Table<CustomerContact, string>
  services!: Table<Service, string>
  serviceParts!: Table<ServicePart, string>
  payments!: Table<Payment, string>
  equipment!: Table<Equipment, string>
  serviceVisits!: Table<ServiceVisit, string>
  expenses!: Table<Expense, string>
  reminders!: Table<Reminder, string>
  calls!: Table<Call, string>
  quotations!: Table<Quotation, string>
  settings!: Table<BusinessSettings, string>
  users!: Table<AppUser, string>
  counters!: Table<{ key: string; value: number }, string>
  /** Local journal of deleted row ids that still need deleting in the cloud. */
  outbox!: Table<SyncOutboxRow, number>

  constructor() {
    super('techcity_db')
    this.version(1).stores({
      customers: 'id, code, name, phone, altPhone, email, city, dateAdded, createdAt, isDemo',
      services:
        'id, code, customerId, serviceDate, serviceType, status, paymentStatus, nextServiceDate, warrantyExpiry, createdAt, isDemo',
      serviceParts: 'id, serviceId, createdAt',
      payments: 'id, serviceId, customerId, date, createdAt',
      equipment: 'id, code, customerId, productType, status, warrantyExpiry, createdAt, isDemo',
      reminders: 'id, customerId, serviceId, type, dueDate, done, createdAt, isDemo',
      settings: 'id',
      users: 'id',
      counters: 'key',
    })

    // v2 — parts gained a `position` column so line items always render in the
    // order the technician entered them. Only the index changes here; existing
    // rows are backfilled by backfillPartPositions() after the database opens
    // (writes inside a Dexie upgrade transaction are not reliably persisted).
    this.version(2).stores({ serviceParts: 'id, serviceId, position, createdAt' })

    // v3 — customers gained a `customer_contacts` table (multiple people per
    // customer), plus `gstNumber` and `password` columns on the customer row,
    // and `serviceMode` on services. Only the contacts table is new; the extra
    // columns are additive and need no row backfill (undefined = not set).
    this.version(3).stores({
      customers: 'id, code, name, phone, altPhone, email, city, gstNumber, dateAdded, createdAt, isDemo',
      services:
        'id, code, customerId, serviceDate, serviceType, status, serviceMode, paymentStatus, nextServiceDate, warrantyExpiry, createdAt, isDemo',
      customerContacts: 'id, customerId, position, createdAt',
    })

    // v4 — call book (calls table) and quotations. Customers also gained
    // AMC / complaint-attended columns — those are additive row fields, so
    // no index change is needed (undefined = not set).
    this.version(4).stores({
      calls: 'id, date, source, customerId, status, createdAt',
      quotations: 'id, code, customerId, date, status, createdAt',
    })

    // v5 — outbox journal for the optional Supabase (cloud) sync. When a row
    // is deleted locally its id is journaled here so the next successful sync
    // can delete it from the cloud too. Local-only apps never touch it.
    this.version(5).stores({
      outbox: '++id, table, rowId, at',
    })

    // v6 — service visit log (multiple trips per service) and the expenses
    // tracker (spending vs earning). Services also gained `deliveryCharge`
    // and `finishedDate` columns and customers/calls a `distanceKm` column;
    // those are additive row fields needing no index (undefined = not set).
    this.version(6).stores({
      serviceVisits: 'id, serviceId, customerId, date, createdAt',
      expenses: 'id, date, type, category, serviceId, customerId, createdAt',
    })
  }
}

/** A pending cloud deletion: row `rowId` of table `table` was deleted locally. */
export interface SyncOutboxRow {
  id?: number
  table: string
  rowId: string
  at: string
}

export const db = new TechCityDB()

/**
 * Orders service parts the way the technician entered them.
 * Falls back to createdAt for rows written before the `position` column
 * existed, so line items never appear shuffled.
 */
export function sortParts<T extends { position?: number; createdAt?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ap = a.position ?? Number.MAX_SAFE_INTEGER
    const bp = b.position ?? Number.MAX_SAFE_INTEGER
    if (ap !== bp) return ap - bp
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

/**
 * Orders customer contacts the way the user added them.
 * Falls back to createdAt for rows written before the `position` column existed.
 */
export function sortContacts<T extends { position?: number; createdAt?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ap = a.position ?? Number.MAX_SAFE_INTEGER
    const bp = b.position ?? Number.MAX_SAFE_INTEGER
    if (ap !== bp) return ap - bp
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

/* ------------------------------------------------------------------ */
/* ID generation                                                       */
/* ------------------------------------------------------------------ */

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Atomically produce the next human readable code for an entity.
 * Runs inside a Dexie transaction so two concurrent creates can never collide.
 * Falls back to scanning existing rows so codes stay unique even after an import.
 */
export async function nextCode(kind: 'customer' | 'service' | 'equipment' | 'invoice' | 'quotation') {
  const config = {
    customer: { key: 'customer', prefix: 'TC-CUS-', table: db.customers },
    service: { key: 'service', prefix: 'TC-SRV-', table: db.services },
    equipment: { key: 'equipment', prefix: 'TC-EQP-', table: db.equipment },
    invoice: { key: 'invoice', prefix: 'TC-INV-', table: null },
    quotation: { key: 'quotation', prefix: 'TC-QTN-', table: db.quotations },
  }[kind]

  return db.transaction('rw', db.counters, db.customers, db.services, db.equipment, db.quotations, async () => {
    const row = await db.counters.get(config.key)
    let next = (row?.value ?? 0) + 1

    // Defensive: make sure we never reuse a code that already exists.
    if (config.table) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidate = config.prefix + String(next).padStart(5, '0')
        const clash = await (config.table as Table<{ code: string }, string>)
          .where('code')
          .equals(candidate)
          .count()
        if (!clash) break
        next += 1
      }
    }

    await db.counters.put({ key: config.key, value: next })
    return config.prefix + String(next).padStart(5, '0')
  })
}

/* ------------------------------------------------------------------ */
/* Business settings                                                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_SERVICE_TYPES = [
  'Computer Repair',
  'Laptop Repair',
  'Desktop Service',
  'OS Installation',
  'Software Installation',
  'Virus/Malware Removal',
  'Data Recovery',
  'CCTV Installation',
  'CCTV Maintenance',
  'Camera Replacement',
  'DVR Service',
  'NVR Service',
  'Hard Disk Replacement',
  'Networking',
  'Printer Service',
  'Computer Sales',
  'CCTV Sales',
  'AMC Site Visit',
  'RMA',
  'Installation',
  'Monitoring Service',
  'Other',
]

export const DEFAULT_SETTINGS: BusinessSettings = {
  id: 'business',
  name: 'TECH CITY TECHNOLOGY',
  tagline: 'Computer Sales • Service • CCTV • Networking',
  address: '123 Main Road, Gandhipuram, Coimbatore, Tamil Nadu - 641012',
  phone: '+91 98765 43210',
  altPhone: '',
  email: 'info@techcitytechnology.in',
  website: 'www.techcitytechnology.in',
  gstNumber: '',
  gstEnabled: false,
  defaultTaxPercent: 0,
  logoDataUrl: '',
  terms:
    '1. Service warranty covers only the specific work performed and parts replaced.\n2. Warranty is void in case of physical damage, liquid damage or unauthorised handling.\n3. Goods once delivered will not be taken back. Please verify the device at the time of delivery.\n4. Items not collected within 30 days of service completion may attract storage charges.\n5. Data backup is the responsibility of the customer. We are not liable for any data loss.',
  footerText: 'Thank you for choosing TECH CITY TECHNOLOGY',
  defaultWarrantyPeriod: '3 Months',
  defaultTechnician: '',
  serviceTypes: DEFAULT_SERVICE_TYPES,
  currency: '₹',
  invoicePrefix: 'TC-INV-',
  updatedAt: nowISO(),
}

export async function getSettings(): Promise<BusinessSettings> {
  const existing = await db.settings.get('business')
  if (existing) return { ...DEFAULT_SETTINGS, ...existing }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<BusinessSettings>) {
  const current = await getSettings()
  const merged: BusinessSettings = { ...current, ...patch, id: 'business', updatedAt: nowISO() }
  await db.settings.put(merged)
  return merged
}

/**
 * One-time backfill for databases created before `position` existed (schema v1).
 * Ordering is derived from createdAt, which is the original entry order.
 * Cheap and idempotent: it exits immediately once every row has a position.
 */
export async function backfillPartPositions() {
  const missing = await db.serviceParts.filter((p) => p.position === undefined).count()
  if (!missing) return 0

  const rows = await db.serviceParts.toArray()
  const grouped = new Map<string, ServicePart[]>()
  for (const row of rows) {
    const list = grouped.get(row.serviceId)
    if (list) list.push(row)
    else grouped.set(row.serviceId, [row])
  }
  const updated: ServicePart[] = []
  for (const list of grouped.values()) {
    list.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    list.forEach((row, index) => {
      if (row.position !== index) updated.push({ ...row, position: index })
    })
  }
  if (updated.length) await db.serviceParts.bulkPut(updated)
  return updated.length
}

/** Ensure the DB is open and base rows exist. Safe to call repeatedly. */
export async function initDB() {
  await db.open()
  await getSettings()
  // Never let a migration hiccup stop the app from starting — sortParts()
  // falls back to createdAt ordering anyway.
  try {
    await backfillPartPositions()
  } catch (err) {
    console.warn('Could not backfill service part positions:', err)
  }
  return db
}

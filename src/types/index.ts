/**
 * Core domain types for Tech City Technology — Customer & Service Management System.
 * These mirror the relational tables defined in src/lib/db.ts (and supabase/schema.sql).
 */

export type ID = string

/** Row shared fields */
export interface BaseRow {
  id: ID
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  /** true when the row came from the development seed dataset */
  isDemo?: boolean
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface Customer extends BaseRow {
  code: string // TC-CUS-00001
  name: string
  phone: string
  altPhone?: string
  email?: string
  address?: string
  city?: string
  pincode?: string
  notes?: string
  dateAdded: string // yyyy-mm-dd
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export const SERVICE_STATUSES = [
  'Received',
  'Diagnosis',
  'In Progress',
  'Waiting for Parts',
  'Ready',
  'Delivered',
  'Completed',
  'Cancelled',
] as const
export type ServiceStatus = (typeof SERVICE_STATUSES)[number]

export const PAYMENT_STATUSES = ['Paid', 'Partially Paid', 'Pending'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface Service extends BaseRow {
  code: string // TC-SRV-00001
  customerId: ID
  serviceDate: string // yyyy-mm-dd
  serviceType: string
  status: ServiceStatus

  // device
  product?: string
  brand?: string
  model?: string
  serialNumber?: string

  // work
  complaint: string
  diagnosis?: string
  workPerformed?: string
  technician?: string

  // money
  serviceCharge: number
  partsCost: number
  discount: number
  taxPercent: number
  totalAmount: number
  amountPaid: number
  balance: number
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod

  // warranty & follow-up
  warrantyPeriod?: string // e.g. "3 Months"
  warrantyExpiry?: string // yyyy-mm-dd
  nextServiceDate?: string // yyyy-mm-dd

  notes?: string
}

/** Line item of parts replaced during a service (service_parts table) */
export interface ServicePart extends BaseRow {
  serviceId: ID
  /** Preserves the order the technician entered the parts in. */
  position: number
  name: string
  quantity: number
  unitPrice: number
  total: number
}

/** Individual payment transaction against a service (payments table) */
export interface Payment extends BaseRow {
  serviceId: ID
  customerId: ID
  date: string // yyyy-mm-dd
  amount: number
  method: PaymentMethod
  note?: string
}

/* ------------------------------------------------------------------ */
/* Equipment                                                           */
/* ------------------------------------------------------------------ */

export const EQUIPMENT_STATUSES = ['Active', 'Under Repair', 'Replaced', 'Removed'] as const
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

export interface Equipment extends BaseRow {
  code: string // TC-EQP-00001
  customerId: ID
  productType: string
  brand?: string
  model?: string
  serialNumber?: string
  installationDate?: string
  warrantyPeriod?: string
  warrantyExpiry?: string
  location?: string
  status: EquipmentStatus
  notes?: string
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export type ReminderType = 'Next Service' | 'Warranty' | 'Payment' | 'Custom'

export interface Reminder extends BaseRow {
  customerId: ID
  serviceId?: ID
  type: ReminderType
  title: string
  dueDate: string // yyyy-mm-dd
  done: boolean
  notes?: string
}

/* ------------------------------------------------------------------ */
/* Settings & users                                                    */
/* ------------------------------------------------------------------ */

export interface BusinessSettings {
  id: 'business'
  name: string
  tagline: string
  address: string
  phone: string
  altPhone?: string
  email: string
  website?: string
  gstNumber?: string
  gstEnabled: boolean
  defaultTaxPercent: number
  logoDataUrl?: string
  terms: string
  footerText: string
  defaultWarrantyPeriod: string
  defaultTechnician: string
  serviceTypes: string[]
  currency: string
  invoicePrefix: string
  updatedAt: string
}

export interface AppUser {
  id: 'owner'
  username: string
  /** SHA-256 hash of the passcode — the raw passcode is never stored. */
  passHash: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* View models                                                         */
/* ------------------------------------------------------------------ */

export interface CustomerStats {
  totalServices: number
  totalSpent: number
  totalPaid: number
  outstanding: number
  lastServiceDate?: string
  nextServiceDate?: string
}

export interface CustomerWithStats extends Customer {
  stats: CustomerStats
}

export interface ServiceWithCustomer extends Service {
  customer?: Customer
}

export type DocKind = 'report' | 'invoice' | 'receipt'

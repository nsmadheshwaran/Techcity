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
  /** GST / tax registration number for this customer. */
  gstNumber?: string
  /**
   * Password for installed equipment (camera/DVR/network). Stored in plain
   * text because the business needs to view it on demand — this is a local,
   * single-device app with a passcode lock, not a multi-user web service.
   */
  password?: string
  notes?: string
  dateAdded: string // yyyy-mm-dd
  /** Date the latest complaint was attended (yyyy-mm-dd). */
  complaintDate?: string
  /** AMC (Annual Maintenance Contract) type, e.g. "CCTV AMC" / "Desktop AMC". */
  amcType?: string
  /** AMC duration in years. */
  amcYears?: number
  /** When the current AMC started (yyyy-mm-dd). */
  amcStartDate?: string
  /** When the current AMC expires (yyyy-mm-dd) — derived from start date + years. */
  amcExpiry?: string
}

/**
 * A person associated with a customer (owner, manager, technician contact…).
 * A customer can have any number of contacts; the primary one is typically
 * listed first. Stored in its own table so the list is fully dynamic.
 */
export interface CustomerContact extends BaseRow {
  customerId: ID
  /** Preserves the order the user added the contacts in. */
  position: number
  name: string
  phone: string
  /** Optional label — e.g. "Owner", "Manager", "Accountant". */
  role?: string
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

/** Whether the service was performed on-site or remotely. */
export const SERVICE_MODES = ['Offline', 'Online'] as const
export type ServiceMode = (typeof SERVICE_MODES)[number]

export interface Service extends BaseRow {
  code: string // TC-SRV-00001
  customerId: ID
  serviceDate: string // yyyy-mm-dd
  serviceType: string
  status: ServiceStatus
  /** On-site (Offline) or remote/online service. */
  serviceMode: ServiceMode

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
  /** The price charged to the customer per unit. */
  unitPrice: number
  total: number
  /**
   * Photo of the physical part (serial plate / label), compressed to a JPEG
   * data URL. Lets the owner zoom in later to read serial numbers of parts
   * like RAM, printers, DVRs — long after the part was replaced.
   */
  photoDataUrl?: string
  /**
   * Internal cost price per unit — what the shop paid the supplier. Only the
   * owner sees it (customer documents never print it); it powers the
   * buy-vs-sell profit shown on the service record and customer profile.
   */
  costPrice?: number
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
/* Calls (call book / call log)                                        */
/* ------------------------------------------------------------------ */

export const CALL_SOURCES = ['Online', 'Direct', 'Demo'] as const
export type CallSource = (typeof CALL_SOURCES)[number]

export const CALL_STATUSES = ['Pending', 'In Progress', 'Completed', 'No Response'] as const
export type CallStatus = (typeof CALL_STATUSES)[number]

export const CALL_PRIORITIES = ['P1', 'P2', 'P3'] as const
export type CallPriority = (typeof CALL_PRIORITIES)[number]

/**
 * A booked call / ticket (single-owner shop — no branches or employees).
 * `name` is the customer / company name; `contactPerson` is the specific
 * person spoken to. `appointmentDate` is the promised visit / follow-up date
 * and auto-creates a reminder.
 */
export interface Call extends BaseRow {
  date: string // yyyy-mm-dd (booked date)
  source: CallSource
  status: CallStatus
  /** Linked saved customer (optional — the caller may be a new lead). */
  customerId?: ID
  name: string
  phone?: string
  contactPerson?: string
  /** What the call is about — free text with shop-style suggestions. */
  issue?: string
  /** Urgency flag (P1 most urgent) — optional. */
  priority?: CallPriority
  /** Promised visit / follow-up date (yyyy-mm-dd) → creates a reminder. */
  appointmentDate?: string
  notes?: string
}

/* ------------------------------------------------------------------ */
/* Quotations                                                          */
/* ------------------------------------------------------------------ */

export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Expired'] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]

export interface QuotationItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  amount: number // quantity × unitPrice
}

/** A quotation built from a customer's saved details. */
export interface Quotation extends BaseRow {
  code: string // TC-QTN-00001
  customerId: ID
  date: string // yyyy-mm-dd
  validUntil?: string // yyyy-mm-dd
  status: QuotationStatus
  items: QuotationItem[]
  discount: number
  taxPercent: number
  subtotal: number
  taxAmount: number
  totalAmount: number
  notes?: string
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

export interface QuotationWithCustomer extends Quotation {
  customer?: Customer
}

export type DocKind = 'report' | 'invoice' | 'receipt' | 'history' | 'quotation'

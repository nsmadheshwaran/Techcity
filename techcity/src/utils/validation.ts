/** Lightweight form validation helpers. Returns a map of field -> error message. */

export type Errors<T> = Partial<Record<keyof T | string, string>>

export const PHONE_RE = /^[+]?[0-9\s-]{10,15}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PINCODE_RE = /^[1-9][0-9]{5}$/

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13 && PHONE_RE.test(value.trim())
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export interface CustomerInput {
  name: string
  phone: string
  altPhone?: string
  email?: string
  pincode?: string
}

export function validateCustomer(v: CustomerInput): Errors<CustomerInput> {
  const e: Errors<CustomerInput> = {}
  if (!v.name?.trim()) e.name = 'Customer name is required'
  else if (v.name.trim().length < 2) e.name = 'Name must be at least 2 characters'

  if (!v.phone?.trim()) e.phone = 'Phone number is required'
  else if (!isValidPhone(v.phone)) e.phone = 'Enter a valid phone number (10-13 digits)'

  if (v.altPhone?.trim() && !isValidPhone(v.altPhone))
    e.altPhone = 'Enter a valid alternate phone number'

  if (v.email?.trim() && !isValidEmail(v.email)) e.email = 'Enter a valid email address'

  if (v.pincode?.trim() && !PINCODE_RE.test(v.pincode.trim()))
    e.pincode = 'Pincode must be 6 digits'

  return e
}

export interface ServiceInput {
  customerId: string
  serviceDate: string
  serviceType: string
  complaint: string
  serviceCharge: number
  partsCost: number
  discount: number
  amountPaid: number
  total: number
  allowOverpay?: boolean
}

export function validateService(v: ServiceInput): Errors<ServiceInput> {
  const e: Errors<ServiceInput> = {}
  if (!v.customerId) e.customerId = 'Please select a customer'
  if (!v.serviceDate) e.serviceDate = 'Service date is required'
  if (!v.serviceType?.trim()) e.serviceType = 'Service type is required'
  if (!v.complaint?.trim()) e.complaint = 'Complaint / problem reported is required'

  if (v.serviceCharge < 0) e.serviceCharge = 'Amount cannot be negative'
  if (v.partsCost < 0) e.partsCost = 'Amount cannot be negative'
  if (v.discount < 0) e.discount = 'Discount cannot be negative'
  if (v.amountPaid < 0) e.amountPaid = 'Amount cannot be negative'

  const gross = (v.serviceCharge || 0) + (v.partsCost || 0)
  if (v.discount > gross) e.discount = 'Discount cannot exceed service charge + parts cost'
  if (!v.allowOverpay && v.amountPaid > v.total + 0.001)
    e.amountPaid = 'Amount paid cannot exceed the total amount'

  return e
}

export function hasErrors(e: Record<string, string | undefined>): boolean {
  return Object.values(e).some(Boolean)
}

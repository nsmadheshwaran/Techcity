/** Formatting helpers used across the app and the PDF documents. */

export function formatMoney(value: number | undefined | null, currency = '₹'): string {
  const n = Number(value ?? 0)
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${n < 0 ? '-' : ''}${currency}${formatted}`
}

/** Same as formatMoney but without the currency symbol (for PDFs / CSV). */
export function formatAmount(value: number | undefined | null): string {
  const n = Number(value ?? 0)
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Parse a yyyy-mm-dd string as a *local* date (avoids UTC off-by-one). */
export function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 15 Aug 2026 */
export function formatDate(value?: string | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 15 August 2026 */
export function formatDateLong(value?: string | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
}

/** 11-Aug-2026 (used in WhatsApp messages / PDFs) */
export function formatDateShort(value?: string | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

export function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(dateISO: string, days: number): string {
  const d = parseDate(dateISO) ?? new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(dateISO: string, months: number): string {
  const d = parseDate(dateISO) ?? new Date()
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0) // clamp to end of month
  return toISODate(d)
}

/** Whole days from today to the given date. Negative = overdue. */
export function daysUntil(dateISO?: string | null): number | null {
  const d = parseDate(dateISO)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

/** "Due in 10 days" / "Due today" / "Overdue by 3 days" */
export function dueLabel(dateISO?: string | null): string {
  const n = daysUntil(dateISO)
  if (n === null) return '—'
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  if (n > 1) return `Due in ${n} days`
  if (n === -1) return 'Overdue by 1 day'
  return `Overdue by ${Math.abs(n)} days`
}

export function relativeLabel(dateISO?: string | null): string {
  const n = daysUntil(dateISO)
  if (n === null) return '—'
  if (n === 0) return 'Today'
  if (n === -1) return 'Yesterday'
  if (n === 1) return 'Tomorrow'
  if (n < 0) return `${Math.abs(n)} days ago`
  return `in ${n} days`
}

/** Parse warranty text like "1 Year", "6 Months", "90 Days" into an expiry date. */
export function warrantyExpiryFrom(startISO: string, period?: string): string | undefined {
  if (!period) return undefined
  const p = period.trim().toLowerCase()
  if (!p || p === 'none' || p === 'no warranty') return undefined
  const m = /^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years|yr|yrs|d|m|y)$/.exec(p)
  if (!m) return undefined
  const qty = Number(m[1])
  const unit = m[2]
  if (unit.startsWith('d')) return addDays(startISO, qty)
  if (unit.startsWith('w')) return addDays(startISO, qty * 7)
  if (unit.startsWith('y')) return addMonths(startISO, Math.round(qty * 12))
  return addMonths(startISO, Math.round(qty))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Normalise an Indian phone number for a wa.me link (defaults to +91). */
export function toWhatsAppNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `91${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `91${digits.slice(1)}`
  return digits
}

export function monthKey(dateISO?: string | null): string {
  const d = parseDate(dateISO)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`
}

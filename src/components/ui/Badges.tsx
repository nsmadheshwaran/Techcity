import type { PaymentStatus, ServiceStatus, EquipmentStatus } from '@/types'

/**
 * Status tags. Colour is the only signal that carries meaning here, so the
 * shapes stay identical across every module — a technician should be able to
 * read "amber = waiting on something" without reading the word.
 *
 * Neutral grey = not started, blue = in flight, amber = blocked,
 * green = done/paid, red = problem/overdue.
 */
const SERVICE_STATUS_STYLES: Record<ServiceStatus, string> = {
  Received: 'bg-ink-100 text-ink-700 border-ink-200',
  Diagnosis: 'bg-violet-50 text-violet-700 border-violet-200',
  'In Progress': 'bg-brand-50 text-brand-700 border-brand-200',
  'Waiting for Parts': 'bg-amber-50 text-amber-800 border-amber-200',
  Ready: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  Delivered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
}

const SERVICE_DOT: Record<ServiceStatus, string> = {
  Received: 'bg-ink-400',
  Diagnosis: 'bg-violet-500',
  'In Progress': 'bg-brand-500',
  'Waiting for Parts': 'bg-amber-500',
  Ready: 'bg-cyan-500',
  Delivered: 'bg-indigo-500',
  Completed: 'bg-emerald-500',
  Cancelled: 'bg-rose-500',
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className={`badge ${SERVICE_STATUS_STYLES[status] ?? SERVICE_STATUS_STYLES.Received}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SERVICE_DOT[status] ?? 'bg-ink-400'}`} />
      {status}
    </span>
  )
}

const PAYMENT_STYLES: Record<PaymentStatus, { style: string; dot: string }> = {
  Paid: { style: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Partially Paid': { style: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  Pending: { style: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const conf = PAYMENT_STYLES[status] ?? PAYMENT_STYLES.Pending
  return (
    <span className={`badge ${conf.style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
      {status}
    </span>
  )
}

const EQUIPMENT_STYLES: Record<EquipmentStatus, { style: string; dot: string }> = {
  Active: { style: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Under Repair': { style: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  Replaced: { style: 'bg-ink-100 text-ink-700 border-ink-200', dot: 'bg-ink-400' },
  Removed: { style: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
}

export function EquipmentBadge({ status }: { status: EquipmentStatus }) {
  const conf = EQUIPMENT_STYLES[status] ?? EQUIPMENT_STYLES.Active
  return (
    <span className={`badge ${conf.style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
      {status}
    </span>
  )
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 border-ink-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return <span className={`badge ${tones[tone]}`}>{children}</span>
}

import type { PaymentStatus, ServiceStatus, EquipmentStatus } from '@/types'

const SERVICE_STATUS_STYLES: Record<ServiceStatus, string> = {
  Received: 'bg-slate-50 text-slate-700 border-slate-200',
  Diagnosis: 'bg-violet-50 text-violet-700 border-violet-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Waiting for Parts': 'bg-amber-50 text-amber-800 border-amber-200',
  Ready: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Delivered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const SERVICE_DOT: Record<ServiceStatus, string> = {
  Received: 'bg-slate-500',
  Diagnosis: 'bg-violet-500',
  'In Progress': 'bg-blue-500',
  'Waiting for Parts': 'bg-amber-500',
  Ready: 'bg-cyan-500',
  Delivered: 'bg-indigo-500',
  Completed: 'bg-emerald-500',
  Cancelled: 'bg-red-500',
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className={`badge ${SERVICE_STATUS_STYLES[status] ?? SERVICE_STATUS_STYLES.Received}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SERVICE_DOT[status] ?? 'bg-slate-500'}`} />
      {status}
    </span>
  )
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-800 border-amber-200',
  Pending: 'bg-red-50 text-red-700 border-red-200',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`badge ${PAYMENT_STYLES[status] ?? PAYMENT_STYLES.Pending}`}>{status}</span>
}

const EQUIPMENT_STYLES: Record<EquipmentStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Under Repair': 'bg-amber-50 text-amber-800 border-amber-200',
  Replaced: 'bg-slate-50 text-slate-700 border-slate-200',
  Removed: 'bg-red-50 text-red-700 border-red-200',
}

export function EquipmentBadge({ status }: { status: EquipmentStatus }) {
  return <span className={`badge ${EQUIPMENT_STYLES[status] ?? EQUIPMENT_STYLES.Active}`}>{status}</span>
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
    danger: 'bg-red-50 text-red-700 border-red-200',
  }
  return <span className={`badge ${tones[tone]}`}>{children}</span>
}

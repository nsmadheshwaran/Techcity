import type { PaymentStatus, ServiceStatus, EquipmentStatus } from '@/types'

const SERVICE_STATUS_STYLES: Record<ServiceStatus, string> = {
  Received: 'bg-slate-100 text-slate-700 border-slate-200/80',
  Diagnosis: 'bg-violet-50 text-violet-700 border-violet-200/80',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200/80',
  'Waiting for Parts': 'bg-amber-50 text-amber-800 border-amber-200/80',
  Ready: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
  Delivered: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80',
}

const SERVICE_DOT: Record<ServiceStatus, string> = {
  Received: 'bg-slate-400',
  Diagnosis: 'bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.6)]',
  'In Progress': 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)] animate-pulse',
  'Waiting for Parts': 'bg-amber-500',
  Ready: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]',
  Delivered: 'bg-indigo-500',
  Completed: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]',
  Cancelled: 'bg-rose-500',
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className={`badge ${SERVICE_STATUS_STYLES[status] ?? SERVICE_STATUS_STYLES.Received}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SERVICE_DOT[status] ?? 'bg-slate-400'}`} />
      {status}
    </span>
  )
}

const PAYMENT_STYLES: Record<PaymentStatus, { style: string; dot: string }> = {
  Paid: {
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]',
  },
  'Partially Paid': {
    style: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  Pending: {
    style: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
  },
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
  Active: {
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  'Under Repair': {
    style: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  Replaced: {
    style: 'bg-slate-100 text-slate-700 border-slate-200/80',
    dot: 'bg-slate-400',
  },
  Removed: {
    style: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
  },
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
    neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
    brand: 'bg-brand-50 text-brand-700 border-brand-200/80',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
  }
  return <span className={`badge ${tones[tone]}`}>{children}</span>
}

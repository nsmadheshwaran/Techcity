import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  to?: string
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-ink-100 text-ink-600',
}

export function StatCard({ label, value, icon: Icon, hint, to, tone = 'neutral' }: Props) {
  const body = (
    <div className="card flex h-full items-start gap-3 p-4 transition-shadow hover:shadow-md">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-ink-900">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11.5px] text-ink-500">{hint}</p>}
      </div>
    </div>
  )
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

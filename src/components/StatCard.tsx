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

/**
 * Flat KPI tile. Colour carries meaning (overdue is red, collected is green),
 * so the tone is drawn as a left accent bar and a tinted icon rather than a
 * gradient — the number stays the loudest thing on the tile.
 */
const TONES = {
  brand: { bar: 'bg-brand-600', icon: 'bg-brand-50 text-brand-700' },
  success: { bar: 'bg-emerald-600', icon: 'bg-emerald-50 text-emerald-700' },
  warning: { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-700' },
  danger: { bar: 'bg-rose-600', icon: 'bg-rose-50 text-rose-700' },
  neutral: { bar: 'bg-ink-300', icon: 'bg-ink-100 text-ink-600' },
}

export function StatCard({ label, value, icon: Icon, hint, to, tone = 'neutral' }: Props) {
  const t = TONES[tone] ?? TONES.neutral
  const body = (
    <div
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-line bg-white py-3 pl-4 pr-3.5 ${
        to ? 'transition-colors hover:border-brand-300 hover:bg-brand-50/25' : ''
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${t.bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500">
            {label}
          </p>
          <p className="mt-1 truncate text-[22px] font-bold leading-tight tracking-tight text-ink-900 tabular">
            {value}
          </p>
        </div>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${t.icon}`}
          aria-hidden
        >
          <Icon size={16} />
        </span>
      </div>
      {hint && <p className="mt-2 truncate text-[11.5px] text-ink-500">{hint}</p>}
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

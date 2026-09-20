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
  brand: {
    iconBg: 'bg-gradient-to-br from-brand-50 to-blue-100 text-brand-700 ring-1 ring-brand-500/20',
    accent: 'group-hover:border-brand-500/40',
  },
  success: {
    iconBg: 'bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 ring-1 ring-emerald-500/20',
    accent: 'group-hover:border-emerald-500/40',
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-amber-50 to-orange-100 text-amber-800 ring-1 ring-amber-500/20',
    accent: 'group-hover:border-amber-500/40',
  },
  danger: {
    iconBg: 'bg-gradient-to-br from-rose-50 to-red-100 text-rose-700 ring-1 ring-rose-500/20',
    accent: 'group-hover:border-rose-500/40',
  },
  neutral: {
    iconBg: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 ring-1 ring-slate-300/40',
    accent: 'group-hover:border-slate-300',
  },
}

export function StatCard({ label, value, icon: Icon, hint, to, tone = 'neutral' }: Props) {
  const t = TONES[tone] ?? TONES.neutral
  const body = (
    <div className={`card-interactive group relative flex h-full flex-col justify-between overflow-hidden p-4 sm:p-5 ${t.accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-105 ${t.iconBg}`}>
          <Icon size={19} />
        </span>
      </div>
      {hint && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[12px] text-slate-500">
          <span className="truncate">{hint}</span>
        </div>
      )}
    </div>
  )

  return to ? (
    <Link to={to} className="block group">
      {body}
    </Link>
  ) : (
    body
  )
}

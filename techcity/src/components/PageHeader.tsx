import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: string | number
}) {
  const navigate = useNavigate()
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back !== undefined && (
          <button
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="mb-1.5 -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-brand-700"
          >
            <ChevronLeft size={15} /> Back
          </button>
        )}
        <h1 className="truncate text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500 sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

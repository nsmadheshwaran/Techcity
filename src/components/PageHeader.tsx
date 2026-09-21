import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * Module header. Deliberately compact: in a CRM the header is a label for the
 * work area, not a hero banner, so the data below stays above the fold.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  meta,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: string | number
  /** Optional status chips / counts rendered beside the title. */
  meta?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {back !== undefined && (
          <button
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="-ml-1 mb-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[12.5px] font-semibold text-ink-500 transition-colors hover:text-brand-700"
          >
            <ChevronLeft size={14} /> Back
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-[19px] font-bold tracking-tight text-ink-900 sm:text-[21px]">
            {title}
          </h1>
          {meta}
        </div>
        {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

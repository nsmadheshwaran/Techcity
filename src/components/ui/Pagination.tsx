import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * List-view pager. Mirrors the convention every CRM uses: the record range on
 * the left, jump controls on the right, and nothing at all when a single page
 * holds everything.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
  label = 'records',
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onChange: (p: number) => void
  label?: string
}) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-line bg-ink-50/60 px-3 py-2 sm:flex-row">
      <p className="text-[12.5px] text-ink-500 tabular">
        <span className="font-semibold text-ink-800">
          {from}–{to}
        </span>{' '}
        of <span className="font-semibold text-ink-800">{total}</span> {label}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="btn-icon h-7 w-7"
            onClick={() => onChange(1)}
            disabled={page === 1}
            aria-label="First page"
            title="First page"
          >
            <ChevronsLeft size={15} />
          </button>
          <button
            className="btn-icon h-7 w-7"
            onClick={() => onChange(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-2 text-[12.5px] font-semibold text-ink-700 tabular">
            {page} / {pageCount}
          </span>
          <button
            className="btn-icon h-7 w-7"
            onClick={() => onChange(Math.min(pageCount, page + 1))}
            disabled={page === pageCount}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={15} />
          </button>
          <button
            className="btn-icon h-7 w-7"
            onClick={() => onChange(pageCount)}
            disabled={page === pageCount}
            aria-label="Last page"
            title="Last page"
          >
            <ChevronsRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

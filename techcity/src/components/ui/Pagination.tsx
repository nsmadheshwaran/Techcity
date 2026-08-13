import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

/** Client side pagination — keeps big tables fast with thousands of rows. */
export function usePagination<T>(items: T[] | undefined, pageSize = 20) {
  const [page, setPage] = useState(1)
  const total = items?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > pageCount) setPage(1)
  }, [page, pageCount])

  const slice = useMemo(
    () => (items ?? []).slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  )

  return { page, setPage, pageCount, total, slice, pageSize }
}

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
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 sm:flex-row">
      <p className="text-[13px] text-ink-500">
        Showing <span className="font-medium text-ink-800">{from}</span>–
        <span className="font-medium text-ink-800">{to}</span> of{' '}
        <span className="font-medium text-ink-800">{total}</span> {label}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="btn-secondary px-2 py-1.5"
            onClick={() => onChange(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-2 text-[13px] font-medium text-ink-700">
            {page} / {pageCount}
          </span>
          <button
            className="btn-secondary px-2 py-1.5"
            onClick={() => onChange(Math.min(pageCount, page + 1))}
            disabled={page === pageCount}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

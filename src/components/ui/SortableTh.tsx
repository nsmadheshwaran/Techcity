import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import type { SortDir } from './useSort'

/**
 * Sortable column header. The arrow is always rendered — greyed when the
 * column is inactive — so it is obvious which headers can be clicked without
 * having to hover each one.
 */
export function SortableTh<K extends string>({
  label,
  column,
  active,
  dir,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string
  column: K
  /** The currently sorted column, or null when the list is in natural order. */
  active: K | null
  dir: SortDir
  onSort: (key: K) => void
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  const isActive = active === column
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <th
      className={`table-th ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''} ${className}`}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex w-full items-center gap-1 ${justify} rounded transition-colors hover:text-ink-900 ${
          isActive ? 'text-brand-700' : ''
        }`}
        title={`Sort by ${label}`}
      >
        <span className="truncate">{label}</span>
        {isActive ? (
          dir === 'asc' ? (
            <ChevronUp size={13} className="shrink-0" />
          ) : (
            <ChevronDown size={13} className="shrink-0" />
          )
        ) : (
          <ChevronsUpDown size={13} className="shrink-0 text-ink-300" />
        )}
      </button>
    </th>
  )
}

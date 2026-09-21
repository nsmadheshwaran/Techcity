import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'

/**
 * The control strip that sits at the top of every list view.
 *
 * Every module in a CRM is the same shape — pick a view, narrow it, act on the
 * result — so the controls live in one component instead of being re-invented
 * per page. `ViewTabs` is the saved-view row, `SearchInput` the filter box, and
 * `ListToolbar` the container that lays them out and keeps them aligned.
 */
export function ListToolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>
}

export interface ViewTabOption<T extends string> {
  key: T
  label: string
  /** Omitted when a count would be misleading (e.g. a date-relative view). */
  count?: number
}

/** Saved-view selector — "All Customers | Pending Balance | Repeat Clients". */
export function ViewTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly ViewTabOption<T>[]
  onChange: (key: T) => void
}) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
      role="tablist"
      aria-label="Saved views"
    >
      {options.map((opt) => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`view-tab ${active ? 'view-tab-active' : ''}`}
          >
            {opt.label}
            {opt.count !== undefined && <span className="view-tab-count">{opt.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Filter box with a clear affordance, sized for a toolbar row. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  ariaLabel = 'Search records',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        className="input py-1.5 pl-8 pr-8"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          aria-label="Clear search"
          type="button"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

import { X } from 'lucide-react'
import { PAYMENT_STATUSES, SERVICE_STATUSES } from '@/types'
import { SearchInput } from '@/components/ui/ListToolbar'

import { EMPTY_FILTERS, type FilterState } from './serviceFiltersHelper'

export type { FilterState }

/**
 * Filter strip for the service list. Everything stays on screen: status and
 * date range are used constantly here, and putting them behind a disclosure
 * would cost a click every time and let an active filter silently distort the
 * list while out of sight. One compact row is cheaper than that.
 *
 * Renders as toolbar rows, so it is meant to sit inside a `.panel` directly
 * above the table it filters.
 */
export function ServiceFilters({
  filters,
  onChange,
  serviceTypes,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
  serviceTypes: string[]
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  const activeCount = [
    filters.status,
    filters.paymentStatus,
    filters.serviceType,
    filters.from,
    filters.to,
  ].filter(Boolean).length

  return (
    <>
      <div className="toolbar">
        <SearchInput
          className="min-w-0 flex-1"
          value={filters.query}
          onChange={(v) => set({ query: v })}
          placeholder="Search service ID, customer, phone, device or complaint…"
          ariaLabel="Search services"
        />

        {activeCount > 0 && (
          <button
            className="btn-ghost"
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
          >
            <X size={13} /> Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-line bg-ink-50/60 px-3 py-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <select
          className="input py-1.5 text-[12.5px]"
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="__pending">Pending (not completed)</option>
          {SERVICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="input py-1.5 text-[12.5px]"
          value={filters.paymentStatus}
          onChange={(e) => set({ paymentStatus: e.target.value })}
          aria-label="Filter by payment status"
        >
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="input py-1.5 text-[12.5px]"
          value={filters.serviceType}
          onChange={(e) => set({ serviceType: e.target.value })}
          aria-label="Filter by service type"
        >
          <option value="">All service types</option>
          {serviceTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
          <span className="shrink-0 text-[11.5px] font-semibold text-ink-500">From</span>
          <input
            type="date"
            className="input py-1.5 text-[12.5px]"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            aria-label="From date"
          />
        </label>
        <label className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
          <span className="shrink-0 text-[11.5px] font-semibold text-ink-500">To</span>
          <input
            type="date"
            className="input py-1.5 text-[12.5px]"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            aria-label="To date"
          />
        </label>
      </div>
    </>
  )
}

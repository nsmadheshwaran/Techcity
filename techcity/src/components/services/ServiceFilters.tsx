import { Search, X } from 'lucide-react'
import { PAYMENT_STATUSES, SERVICE_STATUSES } from '@/types'

export interface FilterState {
  query: string
  status: string
  paymentStatus: string
  serviceType: string
  from: string
  to: string
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  status: '',
  paymentStatus: '',
  serviceType: '',
  from: '',
  to: '',
}

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
  const active =
    filters.status || filters.paymentStatus || filters.serviceType || filters.from || filters.to

  return (
    <div className="card mb-4 space-y-3 p-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-9 pr-9"
          placeholder="Search service ID, customer, phone, device or complaint…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
        />
        {filters.query && (
          <button
            onClick={() => set({ query: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <select
          className="input py-2 text-[13px]"
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
          className="input py-2 text-[13px]"
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
          className="input py-2 text-[13px]"
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

        <input
          type="date"
          className="input py-2 text-[13px]"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
          aria-label="From date"
        />
        <input
          type="date"
          className="input py-2 text-[13px]"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
          aria-label="To date"
        />
      </div>

      {active && (
        <button
          className="btn-ghost px-2 py-1 text-[12.5px]"
          onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
        >
          <X size={13} /> Clear filters
        </button>
      )}
    </div>
  )
}

const PENDING_STATUSES = ['Received', 'Diagnosis', 'In Progress', 'Waiting for Parts', 'Ready']

export function applyFilters<
  T extends {
    code: string
    serviceType: string
    status: string
    paymentStatus: string
    serviceDate: string
    complaint: string
    customerId: string
    product?: string
    brand?: string
    model?: string
    serialNumber?: string
  },
>(
  rows: T[],
  filters: FilterState,
  customerLookup: (id: string) => { name: string; phone: string; code: string } | undefined,
): T[] {
  const q = filters.query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  return rows.filter((s) => {
    if (filters.status === '__pending') {
      if (!PENDING_STATUSES.includes(s.status)) return false
    } else if (filters.status && s.status !== filters.status) return false
    if (filters.paymentStatus && s.paymentStatus !== filters.paymentStatus) return false
    if (filters.serviceType && s.serviceType !== filters.serviceType) return false
    if (filters.from && s.serviceDate < filters.from) return false
    if (filters.to && s.serviceDate > filters.to) return false
    if (!q) return true

    const c = customerLookup(s.customerId)
    const haystack = [
      s.code,
      s.serviceType,
      s.complaint,
      s.product,
      s.brand,
      s.model,
      s.serialNumber,
      c?.name,
      c?.code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (haystack.includes(q)) return true
    if (digits.length >= 3 && c?.phone.replace(/\D/g, '').includes(digits)) return true
    return false
  })
}

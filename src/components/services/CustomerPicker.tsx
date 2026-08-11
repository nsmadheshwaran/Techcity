import { useMemo, useState } from 'react'
import { Check, Phone, Search, UserPlus, X } from 'lucide-react'
import { useCustomersWithStats } from '@/hooks/useData'
import { searchCustomers } from '@/services/customers'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { formatMoney, initials } from '@/utils/format'
import type { Customer } from '@/types'

/**
 * Search-as-you-type customer selector with an inline "create new customer"
 * shortcut — this is what keeps the "record a service in under 2 minutes" promise.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (id: string) => void
  error?: string
}) {
  const customers = useCustomersWithStats()
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const selected = useMemo(
    () => (customers ?? []).find((c) => c.id === value),
    [customers, value],
  )

  const results = useMemo(() => {
    if (!query.trim()) return (customers ?? []).slice(0, 6)
    return searchCustomers(customers ?? [], query).slice(0, 8)
  }, [customers, query])

  const digitsOnly = query.replace(/\D/g, '')
  const initialForNew = /^\d/.test(query.trim())
    ? { phone: digitsOnly }
    : { name: query.trim() }

  if (selected) {
    return (
      <div>
        <label className="field-label">
          Customer <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
            {initials(selected.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">{selected.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-600">
              <span className="inline-flex items-center gap-1">
                <Phone size={11} /> {selected.phone}
              </span>
              <span>· {selected.code}</span>
              <span>· {selected.stats.totalServices} services</span>
              <span>· {formatMoney(selected.stats.totalSpent)} total</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange('')
              setQuery('')
            }}
            className="shrink-0 rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-white hover:text-ink-800"
            aria-label="Change customer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="field-label" htmlFor="customer-search">
        Customer <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          id="customer-search"
          className={`input pl-9 ${error ? 'input-error' : ''}`}
          placeholder="Search existing customer by name, phone or ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {error && <p className="mt-1 text-[12px] font-medium text-red-600">{error}</p>}

      <div className="mt-2 overflow-hidden rounded-lg border border-ink-200">
        <div className="max-h-56 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-ink-500">
              No customer matched “{query}”.
            </p>
          ) : (
            results.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  onChange(c.id)
                  setQuery('')
                }}
                className="flex w-full items-center gap-3 border-b border-ink-100 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-ink-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink-900">
                    {c.name}
                  </span>
                  <span className="block truncate text-[12px] text-ink-500">
                    {c.phone} · {c.code} · {c.stats.totalServices} services
                  </span>
                </span>
                <Check size={15} className="shrink-0 text-ink-300" />
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center gap-2 border-t border-ink-200 bg-ink-50 px-3 py-2.5 text-[13px] font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          <UserPlus size={15} /> Create new customer
          {query.trim() && <span className="text-ink-500">“{query.trim()}”</span>}
        </button>
      </div>

      <CustomerFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initial={initialForNew}
        onSaved={(c: Customer) => {
          onChange(c.id)
          setQuery('')
        }}
      />
    </div>
  )
}

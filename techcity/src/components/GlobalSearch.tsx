import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Search, User, Wrench, X } from 'lucide-react'
import { useCustomersWithStats, useServices } from '@/hooks/useData'
import { searchCustomers } from '@/services/customers'
import { formatDate, formatMoney, initials } from '@/utils/format'

/**
 * Global search — matches customers by name / phone / customer ID / email and
 * services by service ID, device or type. Opens with Ctrl+K (or "/" on desktop).
 *
 * The dialog is rendered ONCE by <GlobalSearchProvider> (in AppLayout); the
 * desktop bar and the mobile icon are only triggers, so the shortcut can never
 * open two overlapping dialogs.
 */

const SearchContext = createContext<{ open: () => void } | null>(null)

export function useGlobalSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useGlobalSearch must be used inside <GlobalSearchProvider>')
  return ctx
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open: () => setOpen(true) }), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && /input|textarea|select/i.test(target.tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchDialog open={open} onClose={() => setOpen(false)} />
    </SearchContext.Provider>
  )
}

/** Trigger button — a search bar on desktop, an icon on mobile. */
export function GlobalSearch({ variant = 'bar' }: { variant?: 'bar' | 'icon' }) {
  const { open } = useGlobalSearch()

  if (variant === 'icon') {
    return (
      <button
        onClick={open}
        className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100"
        aria-label="Search"
      >
        <Search size={20} />
      </button>
    )
  }

  return (
    <button
      onClick={open}
      className="group flex w-full max-w-md items-center gap-2.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-left text-sm text-ink-400 transition-colors hover:border-ink-400"
    >
      <Search size={16} className="shrink-0" />
      <span className="flex-1 truncate">Search customers, phone, service ID…</span>
      <kbd className="hidden shrink-0 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-500 lg:block">
        Ctrl K
      </kbd>
    </button>
  )
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const customers = useCustomersWithStats()
  const services = useServices()

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 40)
      return () => clearTimeout(t)
    }
    setQuery('')
    setActive(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return { customers: [], services: [] }
    const matchedCustomers = searchCustomers(customers ?? [], q).slice(0, 6)
    const lower = q.toLowerCase()
    const matchedServices = (services ?? [])
      .filter(
        (s) =>
          s.code.toLowerCase().includes(lower) ||
          s.serviceType.toLowerCase().includes(lower) ||
          (s.serialNumber ?? '').toLowerCase().includes(lower) ||
          (s.model ?? '').toLowerCase().includes(lower),
      )
      .slice(0, 5)
    return { customers: matchedCustomers, services: matchedServices }
  }, [query, customers, services])

  const flat = useMemo(
    () => [
      ...results.customers.map((c) => ({ kind: 'customer' as const, id: c.id })),
      ...results.services.map((s) => ({ kind: 'service' as const, id: s.id })),
    ],
    [results],
  )

  const go = useCallback(
    (item: { kind: 'customer' | 'service'; id: string }) => {
      onClose()
      navigate(item.kind === 'customer' ? `/customers/${item.id}` : `/services/${item.id}`)
    },
    [navigate, onClose],
  )

  const customerMap = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c])), [customers])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[8vh] sm:pt-[12vh] no-print">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up">
        <div className="flex items-center gap-3 border-b border-ink-200 px-4">
          <Search size={18} className="shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, flat.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && flat[active]) {
                e.preventDefault()
                go(flat[active])
              }
            }}
            placeholder="Type a name, phone number, customer ID or service ID…"
            className="flex-1 border-0 bg-transparent py-3.5 text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink-500">
              Search across customers and service records.
              <div className="mt-2 text-ink-400">
                Try a phone number like <span className="font-medium">9876543210</span> or a service
                ID like <span className="font-medium">TC-SRV-00001</span>
              </div>
            </div>
          ) : flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink-500">
              No results for “{query}”.
            </div>
          ) : (
            <div className="p-2">
              {results.customers.length > 0 && (
                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Customers
                </p>
              )}
              {results.customers.map((c, i) => (
                <button
                  key={c.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go({ kind: 'customer', id: c.id })}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                    active === i ? 'bg-brand-50' : 'hover:bg-ink-50'
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{c.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> {c.phone}
                      </span>
                      <span>·</span>
                      <span>{c.stats.totalServices} services</span>
                      <span>·</span>
                      <span>{formatMoney(c.stats.totalSpent)} total</span>
                    </span>
                  </span>
                  <User size={14} className="shrink-0 text-ink-300" />
                </button>
              ))}

              {results.services.length > 0 && (
                <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Services
                </p>
              )}
              {results.services.map((s, i) => {
                const idx = results.customers.length + i
                return (
                  <button
                    key={s.id}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go({ kind: 'service', id: s.id })}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                      active === idx ? 'bg-brand-50' : 'hover:bg-ink-50'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                      <Wrench size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {s.serviceType} <span className="font-normal text-ink-500">· {s.code}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-500">
                        {customerMap.get(s.customerId)?.name ?? 'Unknown customer'} ·{' '}
                        {formatDate(s.serviceDate)} · {formatMoney(s.totalAmount)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

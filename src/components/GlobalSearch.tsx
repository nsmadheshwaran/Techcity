import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CreditCard,
  Database,
  Phone,
  PhoneCall,
  ScrollText,
  Search,
  Sparkles,
  User,
  UserPlus,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import { useCustomersWithStats, useEquipment, useQuotations, useServices } from '@/hooks/useData'
import { searchCustomers } from '@/services/customers'
import { formatDate, formatMoney, initials } from '@/utils/format'
import { SearchContext, useGlobalSearch } from './SearchContext'


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

/** Trigger button — sleek command bar on desktop, icon on mobile. */
export function GlobalSearch({ variant = 'bar' }: { variant?: 'bar' | 'icon' }) {
  const { open } = useGlobalSearch()

  if (variant === 'icon') {
    return (
      <button
        onClick={open}
        className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 active:scale-95"
        aria-label="Search"
      >
        <Search size={20} />
      </button>
    )
  }

  return (
    <button
      onClick={open}
      className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-2 text-left text-sm text-slate-400 transition-all hover:border-brand-500/40 hover:bg-white hover:text-slate-600 hover:shadow-xs focus:outline-none"
    >
      <Search size={16} className="shrink-0 text-slate-400 transition-colors group-hover:text-brand-600" />
      <span className="flex-1 truncate text-xs sm:text-[13px]">
        Search customers, phone, services, quotes…
      </span>
      <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-500 shadow-2xs lg:inline-flex">
        <span className="text-[11px]">Ctrl</span> K
      </kbd>
    </button>
  )
}

const QUICK_ACTIONS = [
  { label: 'New Service Job', icon: Wrench, to: '/services/new', tone: 'text-brand-600 bg-brand-50' },
  { label: 'Add New Customer', icon: UserPlus, to: '/customers', tone: 'text-emerald-600 bg-emerald-50' },
  { label: 'Record Customer Call', icon: PhoneCall, to: '/calls', tone: 'text-amber-600 bg-amber-50' },
  { label: 'Create Quotation', icon: ScrollText, to: '/quotations/new', tone: 'text-purple-600 bg-purple-50' },
  { label: 'Record Payment', icon: CreditCard, to: '/payments', tone: 'text-teal-600 bg-teal-50' },
  { label: 'Track Expense', icon: Wallet, to: '/expenses', tone: 'text-rose-600 bg-rose-50' },
  { label: 'Database Backup & Export', icon: Database, to: '/settings?tab=backup', tone: 'text-slate-600 bg-slate-100' },
]

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const customers = useCustomersWithStats()
  const services = useServices()
  const quotations = useQuotations()
  const equipment = useEquipment()

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
    if (!q) return { customers: [], services: [], quotations: [], equipment: [] }
    const matchedCustomers = searchCustomers(customers ?? [], q).slice(0, 5)
    const lower = q.toLowerCase()
    const matchedServices = (services ?? [])
      .filter(
        (s) =>
          s.code.toLowerCase().includes(lower) ||
          s.serviceType.toLowerCase().includes(lower) ||
          (s.serialNumber ?? '').toLowerCase().includes(lower) ||
          (s.product ?? '').toLowerCase().includes(lower) ||
          (s.brand ?? '').toLowerCase().includes(lower) ||
          (s.model ?? '').toLowerCase().includes(lower),
      )
      .slice(0, 4)

    const matchedQuotes = (quotations ?? [])
      .filter(
        (qu) =>
          qu.code.toLowerCase().includes(lower) ||
          (qu.notes ?? '').toLowerCase().includes(lower),
      )
      .slice(0, 3)

    const matchedEquip = (equipment ?? [])
      .filter(
        (eq) =>
          eq.code.toLowerCase().includes(lower) ||
          eq.productType.toLowerCase().includes(lower) ||
          (eq.serialNumber ?? '').toLowerCase().includes(lower),
      )
      .slice(0, 3)

    return {
      customers: matchedCustomers,
      services: matchedServices,
      quotations: matchedQuotes,
      equipment: matchedEquip,
    }
  }, [query, customers, services, quotations, equipment])

  const flat = useMemo(() => {
    if (!query.trim()) {
      return QUICK_ACTIONS.map((a) => ({ kind: 'action' as const, to: a.to }))
    }
    return [
      ...results.customers.map((c) => ({ kind: 'customer' as const, id: c.id })),
      ...results.services.map((s) => ({ kind: 'service' as const, id: s.id })),
      ...results.quotations.map((q) => ({ kind: 'quote' as const, id: q.id })),
      ...results.equipment.map((e) => ({ kind: 'equipment' as const, id: e.id })),
    ]
  }, [query, results])

  const go = useCallback(
    (item: (typeof flat)[number]) => {
      onClose()
      if (item.kind === 'action') navigate(item.to)
      else if (item.kind === 'customer') navigate(`/customers/${item.id}`)
      else if (item.kind === 'service') navigate(`/services/${item.id}`)
      else if (item.kind === 'quote') navigate('/quotations')
      else if (item.kind === 'equipment') navigate('/equipment')
    },
    [navigate, onClose],
  )

  const customerMap = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c])), [customers])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[8vh] sm:pt-[12vh] no-print">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200/90 animate-slide-up">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 bg-slate-50/40">
          <Search size={18} className="shrink-0 text-slate-400" />
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
            className="flex-1 border-0 bg-transparent text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Clear query"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-400 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results / Quick Actions */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!query.trim() ? (
            <div>
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Sparkles size={12} className="text-brand-500" /> Quick Actions & Navigation
              </div>
              <div className="space-y-0.5">
                {QUICK_ACTIONS.map((action, i) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.to}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go({ kind: 'action', to: action.to })}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                        active === i ? 'bg-brand-50 text-brand-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.tone}`}>
                        <Icon size={15} />
                      </span>
                      <span className="flex-1">{action.label}</span>
                      <ArrowRight size={13} className="text-slate-300" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No matching records found for <span className="font-semibold text-slate-800">“{query}”</span>.
            </div>
          ) : (
            <div className="space-y-3">
              {results.customers.length > 0 && (
                <div>
                  <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Customers ({results.customers.length})
                  </p>
                  <div className="space-y-0.5">
                    {results.customers.map((c, i) => (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go({ kind: 'customer', id: c.id })}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                          active === i ? 'bg-brand-50 ring-1 ring-brand-500/20' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-700">
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{c.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Phone size={11} /> {c.phone}
                            </span>
                            <span>·</span>
                            <span>{c.stats.totalServices} services</span>
                            <span>·</span>
                            <span className="font-medium text-emerald-700">{formatMoney(c.stats.totalSpent)} total</span>
                          </span>
                        </span>
                        <User size={14} className="shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.services.length > 0 && (
                <div>
                  <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Services ({results.services.length})
                  </p>
                  <div className="space-y-0.5">
                    {results.services.map((s, i) => {
                      const idx = results.customers.length + i
                      return (
                        <button
                          key={s.id}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go({ kind: 'service', id: s.id })}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                            active === idx ? 'bg-brand-50 ring-1 ring-brand-500/20' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <Wrench size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {s.serviceType} <span className="text-xs font-normal text-slate-500">· {s.code}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                              {customerMap.get(s.customerId)?.name ?? 'Unknown customer'} ·{' '}
                              {formatDate(s.serviceDate)} · <span className="font-medium text-slate-800">{formatMoney(s.totalAmount)}</span>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {results.quotations.length > 0 && (
                <div>
                  <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Quotations ({results.quotations.length})
                  </p>
                  <div className="space-y-0.5">
                    {results.quotations.map((qu, i) => {
                      const idx = results.customers.length + results.services.length + i
                      return (
                        <button
                          key={qu.id}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go({ kind: 'quote', id: qu.id })}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                            active === idx ? 'bg-brand-50 ring-1 ring-brand-500/20' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                            <ScrollText size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">{qu.code}</span>
                            <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                              {formatDate(qu.date)} · <span className="font-medium text-slate-800">{formatMoney(qu.totalAmount)}</span>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border bg-white px-1 py-0.5 text-[10px]">↑↓</kbd> to navigate</span>
            <span><kbd className="rounded border bg-white px-1 py-0.5 text-[10px]">↵</kbd> to select</span>
          </div>
          <span>Tech City Universal Search</span>
        </div>
      </div>
    </div>
  )
}

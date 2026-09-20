import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/components/ui/usePagination'
import { useToast } from '@/components/ui/Toast'
import { useCustomersWithStats, useSettings } from '@/hooks/useData'
import { searchCustomers } from '@/services/customers'
import { exportCustomersCSV } from '@/services/backup'
import { formatDate, formatMoney, initials, toWhatsAppNumber } from '@/utils/format'

type SortKey = 'recent' | 'name' | 'spend' | 'services'
type SegmentFilter = 'all' | 'balance' | 'repeat' | 'recent'

export default function CustomersPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const customers = useCustomersWithStats()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [segment, setSegment] = useState<SegmentFilter>('all')
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = searchCustomers(customers ?? [], query) as NonNullable<typeof customers>

    if (segment === 'balance') {
      list = list.filter((c) => c.stats.outstanding > 0)
    } else if (segment === 'repeat') {
      list = list.filter((c) => c.stats.totalServices > 1)
    } else if (segment === 'recent') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      list = list.filter((c) => (c.stats.lastServiceDate ?? '') >= thirtyDaysAgo)
    }

    const sorted = [...list]
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'spend':
        sorted.sort((a, b) => b.stats.totalSpent - a.stats.totalSpent)
        break
      case 'services':
        sorted.sort((a, b) => b.stats.totalServices - a.stats.totalServices)
        break
      default:
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return sorted
  }, [customers, query, sort, segment])

  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 20)

  async function onExport() {
    try {
      const count = await exportCustomersCSV()
      toast.success('Customers exported', `${count} record(s) saved as CSV.`)
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export data.')
    }
  }

  const segmentCounts = useMemo(() => {
    const all = customers ?? []
    return {
      all: all.length,
      balance: all.filter((c) => c.stats.outstanding > 0).length,
      repeat: all.filter((c) => c.stats.totalServices > 1).length,
    }
  }, [customers])

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={
          customers ? `${customers.length} customer directory records` : 'Loading…'
        }
        actions={
          <>
            <button className="btn-secondary" onClick={onExport} disabled={!customers?.length}>
              <Download size={15} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={15} /> Add Customer
            </button>
          </>
        }
      />

      {/* Segment filters + Search bar */}
      <div className="mb-4 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/80 pb-2">
          {(
            [
              ['all', `All Customers (${segmentCounts.all})`],
              ['balance', `Pending Balance (${segmentCounts.balance})`],
              ['repeat', `Repeat Clients (${segmentCounts.repeat})`],
              ['recent', 'Active in Last 30 Days'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setSegment(key)
                setPage(1)
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                segment === key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card flex flex-col gap-2.5 p-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10 pr-9 py-2"
              placeholder="Search by name, phone, customer ID or email…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            className="input w-full py-2 sm:w-48 text-xs font-medium"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort customers"
          >
            <option value="recent">Recently added</option>
            <option value="name">Name (A–Z)</option>
            <option value="spend">Highest spend</option>
            <option value="services">Most services</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden border border-slate-200/80">
        {!customers ? (
          <SkeletonRows rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query || segment !== 'all' ? 'No matching customers' : 'No customers yet'}
            message={
              query || segment !== 'all'
                ? 'Try adjusting your search query or segment filter.'
                : 'Add your first customer to start recording services.'
            }
            action={
              query || segment !== 'all' ? (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setQuery('')
                    setSegment('all')
                  }}
                >
                  Reset filters
                </button>
              ) : (
                <button className="btn-primary" onClick={() => setAddOpen(true)}>
                  <UserPlus size={16} /> Add Customer
                </button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop CRM Table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-slate-200/80 bg-slate-50/75">
                  <tr>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Contact</th>
                    <th className="table-th">Quick Connect</th>
                    <th className="table-th">City</th>
                    <th className="table-th text-center">Services</th>
                    <th className="table-th text-right">Total Spent</th>
                    <th className="table-th text-right">Outstanding</th>
                    <th className="table-th">Last Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slice.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-indigo-100 text-[12.5px] font-bold text-brand-700 ring-1 ring-brand-500/10 shadow-xs">
                            {initials(c.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{c.name}</p>
                            <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {c.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <p className="font-medium text-slate-800">{c.phone}</p>
                        {c.email && <p className="truncate text-[12px] text-slate-500">{c.email}</p>}
                      </td>
                      {/* 1-Click WhatsApp & Phone buttons */}
                      <td className="table-td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent(
                              `Hello ${c.name.split(' ')[0]}, this is ${settings.name}. How can we assist you today?`,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white hover:shadow-xs"
                            title={`Chat with ${c.name} on WhatsApp`}
                            aria-label={`WhatsApp ${c.name}`}
                          >
                            <MessageCircle size={15} />
                          </a>
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-all hover:bg-brand-600 hover:text-white hover:border-brand-600 hover:shadow-xs"
                            title={`Call ${c.phone}`}
                            aria-label={`Call ${c.name}`}
                          >
                            <Phone size={14} />
                          </a>
                        </div>
                      </td>
                      <td className="table-td text-slate-600">{c.city || '—'}</td>
                      <td className="table-td text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {c.stats.totalServices}
                        </span>
                      </td>
                      <td className="table-td text-right font-semibold text-slate-900">
                        {formatMoney(c.stats.totalSpent, settings.currency)}
                      </td>
                      <td className="table-td text-right">
                        {c.stats.outstanding > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-xs font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {formatMoney(c.stats.outstanding, settings.currency)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="table-td whitespace-nowrap text-slate-500 text-xs">
                        {c.stats.lastServiceDate ? formatDate(c.stats.lastServiceDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {slice.map((c) => (
                <li key={c.id}>
                  <div
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="w-full px-4 py-3.5 text-left transition-colors active:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-indigo-100 text-[13px] font-bold text-brand-700 ring-1 ring-brand-500/10">
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[15px] font-bold text-slate-900">{c.name}</p>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                            {c.code}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-600 font-medium">
                          <Phone size={12} className="shrink-0 text-slate-400" /> {c.phone}
                        </p>
                        {c.email && (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-slate-500">
                            <Mail size={12} className="shrink-0 text-slate-400" /> {c.email}
                          </p>
                        )}
                        {c.city && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                            <MapPin size={12} className="shrink-0 text-slate-400" /> {c.city}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[12px]">
                          <div className="flex items-center gap-2.5">
                            <span className="text-slate-600">
                              <span className="font-bold text-slate-900">{c.stats.totalServices}</span> services
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-semibold text-slate-900">
                              {formatMoney(c.stats.totalSpent, settings.currency)}
                            </span>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={`https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent(
                                `Hello ${c.name.split(' ')[0]}, this is ${settings.name}. How can we assist you today?`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 flex items-center gap-1"
                              aria-label={`WhatsApp ${c.name}`}
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </a>
                            <a
                              href={`tel:${c.phone}`}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 flex items-center gap-1"
                              aria-label={`Call ${c.name}`}
                            >
                              <Phone size={13} /> Call
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {pageCount > 1 && (
              <div className="border-t border-slate-200/80 p-3 bg-slate-50/50">
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  pageSize={pageSize}
                  onChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      <CustomerFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

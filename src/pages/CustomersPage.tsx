import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { ListToolbar, SearchInput, ViewTabs } from '@/components/ui/ListToolbar'
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    return {
      all: all.length,
      balance: all.filter((c) => c.stats.outstanding > 0).length,
      repeat: all.filter((c) => c.stats.totalServices > 1).length,
      recent: all.filter((c) => (c.stats.lastServiceDate ?? '') >= thirtyDaysAgo).length,
    }
  }, [customers])

  const filtersActive = Boolean(query) || segment !== 'all'

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={customers ? `${customers.length} records in the directory` : 'Loading…'}
        actions={
          <>
            <button className="btn-secondary" onClick={onExport} disabled={!customers?.length}>
              <Download size={14} /> <span className="sr-only sm:not-sr-only">Export CSV</span>
            </button>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={14} /> Add Customer
            </button>
          </>
        }
      />

      <div className="panel">
        <ListToolbar>
          <ViewTabs
            value={segment}
            onChange={(key) => {
              setSegment(key)
              setPage(1)
            }}
            options={[
              { key: 'all', label: 'All Customers', count: segmentCounts.all },
              { key: 'balance', label: 'Pending Balance', count: segmentCounts.balance },
              { key: 'repeat', label: 'Repeat Clients', count: segmentCounts.repeat },
              { key: 'recent', label: 'Active in 30 Days', count: segmentCounts.recent },
            ]}
          />

          <SearchInput
            className="w-full sm:w-72"
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
            placeholder="Search name, phone, ID or email…"
            ariaLabel="Search customers"
          />

          <select
            className="input w-full py-1.5 text-[12.5px] font-medium sm:w-44"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort customers"
          >
            <option value="recent">Recently added</option>
            <option value="name">Name (A–Z)</option>
            <option value="spend">Highest spend</option>
            <option value="services">Most services</option>
          </select>
        </ListToolbar>

        {!customers ? (
          <SkeletonRows rows={8} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtersActive ? 'No matching customers' : 'No customers yet'}
            message={
              filtersActive
                ? 'Try a different search term or switch back to All Customers.'
                : 'Add your first customer to start recording services.'
            }
            action={
              filtersActive ? (
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
                  <UserPlus size={15} /> Add Customer
                </button>
              )
            }
          />
        ) : (
          <>
            {/* ---------- Desktop data table ---------- */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Contact</th>
                    <th className="table-th">Connect</th>
                    <th className="table-th">City</th>
                    <th className="table-th text-center">Services</th>
                    <th className="table-th text-right">Total Spent</th>
                    <th className="table-th text-right">Outstanding</th>
                    <th className="table-th">Last Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {slice.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="table-row-link"
                    >
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100">
                            {initials(c.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate cell-primary">{c.name}</p>
                            <span className="code-chip">{c.code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <p className="font-medium text-ink-800">{c.phone}</p>
                        {c.email && <p className="truncate text-[12px] cell-muted">{c.email}</p>}
                      </td>
                      {/* One-tap WhatsApp / call, without opening the record */}
                      <td className="table-td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent(
                              `Hello ${c.name.split(' ')[0]}, this is ${settings.name}. How can we assist you today?`,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white"
                            title={`Chat with ${c.name} on WhatsApp`}
                            aria-label={`WhatsApp ${c.name}`}
                          >
                            <MessageCircle size={14} />
                          </a>
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-300 bg-white text-ink-600 transition-colors hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                            title={`Call ${c.phone}`}
                            aria-label={`Call ${c.name}`}
                          >
                            <Phone size={13} />
                          </a>
                        </div>
                      </td>
                      <td className="table-td cell-muted">{c.city || '—'}</td>
                      <td className="table-td text-center font-semibold text-ink-800">
                        {c.stats.totalServices}
                      </td>
                      <td className="table-td text-right font-semibold text-ink-900">
                        {formatMoney(c.stats.totalSpent, settings.currency)}
                      </td>
                      <td className="table-td text-right">
                        {c.stats.outstanding > 0 ? (
                          <span className="font-bold text-rose-700">
                            {formatMoney(c.stats.outstanding, settings.currency)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="table-td whitespace-nowrap cell-muted">
                        {c.stats.lastServiceDate ? formatDate(c.stats.lastServiceDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---------- Mobile / tablet cards ---------- */}
            <ul className="divide-y divide-line-soft lg:hidden">
              {slice.map((c) => (
                <li key={c.id}>
                  <div
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="w-full cursor-pointer px-3.5 py-3 text-left transition-colors active:bg-brand-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700 ring-1 ring-brand-100">
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[14.5px] font-bold text-ink-900">{c.name}</p>
                          <span className="code-chip shrink-0">{c.code}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-ink-700">
                          <Phone size={12} className="shrink-0 text-ink-400" /> {c.phone}
                        </p>
                        {c.email && (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] cell-muted">
                            <Mail size={12} className="shrink-0 text-ink-400" /> {c.email}
                          </p>
                        )}
                        {c.city && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] cell-muted">
                            <MapPin size={12} className="shrink-0 text-ink-400" /> {c.city}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2 text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className="cell-muted">
                              <span className="font-bold text-ink-900">{c.stats.totalServices}</span>{' '}
                              services
                            </span>
                            <span className="text-ink-300">·</span>
                            <span className="font-semibold text-ink-900">
                              {formatMoney(c.stats.totalSpent, settings.currency)}
                            </span>
                            {c.stats.outstanding > 0 && (
                              <>
                                <span className="text-ink-300">·</span>
                                <span className="font-bold text-rose-700">
                                  {formatMoney(c.stats.outstanding, settings.currency)} due
                                </span>
                              </>
                            )}
                          </div>

                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={`https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent(
                                `Hello ${c.name.split(' ')[0]}, this is ${settings.name}. How can we assist you today?`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-700"
                              aria-label={`WhatsApp ${c.name}`}
                            >
                              <MessageCircle size={12} /> WhatsApp
                            </a>
                            <a
                              href={`tel:${c.phone}`}
                              className="flex items-center gap-1 rounded-md border border-ink-300 bg-white px-2 py-1 text-[12px] font-medium text-ink-700"
                              aria-label={`Call ${c.name}`}
                            >
                              <Phone size={12} /> Call
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              label="customers"
            />
          </>
        )}
      </div>

      <CustomerFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

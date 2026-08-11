import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Mail,
  MapPin,
  Phone,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination, usePagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import { useCustomersWithStats, useSettings } from '@/hooks/useData'
import { searchCustomers } from '@/services/customers'
import { exportCustomersCSV } from '@/services/backup'
import { formatDate, formatMoney, initials } from '@/utils/format'

type SortKey = 'recent' | 'name' | 'spend' | 'services'

export default function CustomersPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const customers = useCustomersWithStats()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(() => {
    const list = searchCustomers(customers ?? [], query) as NonNullable<typeof customers>
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
  }, [customers, query, sort])

  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 20)

  async function onExport() {
    try {
      const count = await exportCustomersCSV()
      toast.success('Customers exported', `${count} record(s) saved as CSV.`)
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export data.')
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={
          customers ? `${customers.length} customer${customers.length === 1 ? '' : 's'} on record` : 'Loading…'
        }
        actions={
          <>
            <button className="btn-secondary" onClick={onExport} disabled={!customers?.length}>
              <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={16} /> Add Customer
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9 pr-9"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          className="input w-full py-2 sm:w-48"
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

      <div className="card overflow-hidden">
        {!customers ? (
          <SkeletonRows rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? 'No matching customers' : 'No customers yet'}
            message={
              query
                ? `Nothing matched “${query}”. Try a different name, phone number or customer ID.`
                : 'Add your first customer to start recording services.'
            }
            action={
              query ? (
                <button className="btn-secondary" onClick={() => setQuery('')}>
                  Clear search
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
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Contact</th>
                    <th className="table-th">City</th>
                    <th className="table-th text-center">Services</th>
                    <th className="table-th text-right">Total Spent</th>
                    <th className="table-th text-right">Outstanding</th>
                    <th className="table-th">Last Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {slice.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="cursor-pointer transition-colors hover:bg-ink-50"
                    >
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
                            {initials(c.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">{c.name}</p>
                            <p className="text-[12px] text-ink-500">{c.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <p className="text-ink-800">{c.phone}</p>
                        {c.email && <p className="truncate text-[12px] text-ink-500">{c.email}</p>}
                      </td>
                      <td className="table-td text-ink-600">{c.city || '—'}</td>
                      <td className="table-td text-center font-medium">{c.stats.totalServices}</td>
                      <td className="table-td text-right font-medium">
                        {formatMoney(c.stats.totalSpent, settings.currency)}
                      </td>
                      <td className="table-td text-right">
                        {c.stats.outstanding > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatMoney(c.stats.outstanding, settings.currency)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="table-td whitespace-nowrap text-ink-600">
                        {c.stats.lastServiceDate ? formatDate(c.stats.lastServiceDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <ul className="divide-y divide-ink-100 lg:hidden">
              {slice.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="w-full px-4 py-3.5 text-left transition-colors active:bg-ink-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-700">
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[15px] font-semibold text-ink-900">{c.name}</p>
                          <span className="shrink-0 text-[12px] text-ink-500">{c.code}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-600">
                          <Phone size={12} className="shrink-0" /> {c.phone}
                        </p>
                        {c.email && (
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-500">
                            <Mail size={12} className="shrink-0" /> {c.email}
                          </p>
                        )}
                        {c.city && (
                          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-500">
                            <MapPin size={12} className="shrink-0" /> {c.city}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                          <span className="text-ink-600">
                            <span className="font-semibold text-ink-900">
                              {c.stats.totalServices}
                            </span>{' '}
                            services
                          </span>
                          <span className="text-ink-600">
                            <span className="font-semibold text-ink-900">
                              {formatMoney(c.stats.totalSpent, settings.currency)}
                            </span>{' '}
                            total
                          </span>
                          {c.stats.outstanding > 0 && (
                            <span className="font-medium text-red-600">
                              {formatMoney(c.stats.outstanding, settings.currency)} due
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
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

      <CustomerFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(c) => navigate(`/customers/${c.id}`)}
      />
    </>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import {
  applyFilters,
  EMPTY_FILTERS,
  ServiceFilters,
  type FilterState,
} from '@/components/services/ServiceFilters'
import { PaymentBadge, StatusBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination, usePagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useServices, useSettings } from '@/hooks/useData'
import { exportServicesCSV } from '@/services/backup'
import { formatDate, formatMoney } from '@/utils/format'

export default function ServicesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const services = useServices()
  const customerMap = useCustomerMap()
  const settings = useSettings()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<FilterState>({
    ...EMPTY_FILTERS,
    status: searchParams.get('status') === 'pending' ? '__pending' : '',
  })

  const serviceTypes = useMemo(
    () => [...new Set((services ?? []).map((s) => s.serviceType))].sort(),
    [services],
  )

  const filtered = useMemo(
    () => applyFilters(services ?? [], filters, (id) => customerMap.get(id)),
    [services, filters, customerMap],
  )

  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 20)

  const totals = useMemo(
    () => ({
      billed: filtered.reduce((s, x) => (x.status === 'Cancelled' ? s : s + x.totalAmount), 0),
      collected: filtered.reduce((s, x) => (x.status === 'Cancelled' ? s : s + x.amountPaid), 0),
      due: filtered.reduce((s, x) => (x.status === 'Cancelled' ? s : s + Math.max(0, x.balance)), 0),
    }),
    [filtered],
  )

  async function onExport() {
    try {
      const count = await exportServicesCSV()
      toast.success('Services exported', `${count} record(s) saved as CSV.`)
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export.')
    }
  }

  return (
    <>
      <PageHeader
        title="Services"
        subtitle={services ? `${services.length} service records` : 'Loading…'}
        actions={
          <>
            <button className="btn-secondary" onClick={onExport} disabled={!services?.length}>
              <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button className="btn-primary" onClick={() => navigate('/services/new')}>
              <Plus size={16} /> New Service
            </button>
          </>
        }
      />

      <ServiceFilters filters={filters} onChange={setFilters} serviceTypes={serviceTypes} />

      {filtered.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <SummaryTile label="Billed" value={formatMoney(totals.billed, settings.currency)} />
          <SummaryTile
            label="Collected"
            value={formatMoney(totals.collected, settings.currency)}
            tone="success"
          />
          <SummaryTile
            label="Outstanding"
            value={formatMoney(totals.due, settings.currency)}
            tone={totals.due > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      <div className="card overflow-hidden">
        {!services ? (
          <SkeletonRows rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={services.length ? 'No services match your filters' : 'No services found'}
            message={
              services.length
                ? 'Try adjusting the search text, date range or filters.'
                : 'Create your first service record to get started.'
            }
            action={
              services.length ? (
                <button className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </button>
              ) : (
                <button className="btn-primary" onClick={() => navigate('/services/new')}>
                  <Plus size={16} /> New Service
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th className="table-th">Service</th>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Date</th>
                    <th className="table-th">Device</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th">Payment</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {slice.map((s) => {
                    const c = customerMap.get(s.customerId)
                    return (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/services/${s.id}`)}
                        className="cursor-pointer transition-colors hover:bg-ink-50"
                      >
                        <td className="table-td">
                          <p className="font-medium text-ink-900">{s.serviceType}</p>
                          <p className="text-[12px] text-ink-500">{s.code}</p>
                        </td>
                        <td className="table-td">
                          <p className="text-ink-800">{c?.name ?? 'Unknown'}</p>
                          <p className="text-[12px] text-ink-500">{c?.phone ?? ''}</p>
                        </td>
                        <td className="table-td whitespace-nowrap text-ink-600">
                          {formatDate(s.serviceDate)}
                        </td>
                        <td className="table-td text-ink-600">
                          {[s.product, s.brand].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="table-td text-right font-medium">
                          {formatMoney(s.totalAmount, settings.currency)}
                          {s.balance > 0 && (
                            <span className="mt-0.5 block text-[11.5px] font-normal text-red-600">
                              {formatMoney(s.balance, settings.currency)} due
                            </span>
                          )}
                        </td>
                        <td className="table-td">
                          <PaymentBadge status={s.paymentStatus} />
                        </td>
                        <td className="table-td">
                          <StatusBadge status={s.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 lg:hidden">
              {slice.map((s) => {
                const c = customerMap.get(s.customerId)
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/services/${s.id}`)}
                      className="w-full px-4 py-3.5 text-left transition-colors active:bg-ink-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-semibold text-ink-900">
                            {s.serviceType}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] text-ink-600">
                            {c?.name ?? 'Unknown'} · {c?.phone ?? ''}
                          </p>
                          <p className="mt-0.5 text-[12px] text-ink-500">
                            {formatDate(s.serviceDate)} · {s.code}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[14px] font-semibold text-ink-900">
                            {formatMoney(s.totalAmount, settings.currency)}
                          </p>
                          {s.balance > 0 && (
                            <p className="text-[12px] font-medium text-red-600">
                              {formatMoney(s.balance, settings.currency)} due
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={s.status} />
                        <PaymentBadge status={s.paymentStatus} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              label="services"
            />
          </>
        )}
      </div>
    </>
  )
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  const color =
    tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-red-600' : 'text-ink-900'
  return (
    <div className="card p-3">
      <p className="text-[11.5px] font-medium text-ink-500">{label}</p>
      <p className={`mt-0.5 truncate text-[15px] font-bold tracking-tight sm:text-lg ${color}`}>
        {value}
      </p>
    </div>
  )
}

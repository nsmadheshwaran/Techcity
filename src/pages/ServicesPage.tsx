import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Trash2, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ServiceFilters, type FilterState } from '@/components/services/ServiceFilters'
import { applyFilters, EMPTY_FILTERS } from '@/components/services/serviceFiltersHelper'
import { PaymentBadge, StatusBadge } from '@/components/ui/Badges'
import { BulkBar, RowCheckbox, SelectAllCheckbox } from '@/components/ui/BulkBar'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination } from '@/components/ui/Pagination'
import { SortableTh } from '@/components/ui/SortableTh'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePagination } from '@/components/ui/usePagination'
import { useSelection } from '@/components/ui/useSelection'
import { useSort, useSorted } from '@/components/ui/useSort'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useServices, useSettings } from '@/hooks/useData'
import { exportServicesCSV } from '@/services/backup'
import { deleteService, setServiceStatus } from '@/services/services'
import { SERVICE_STATUSES } from '@/types'
import { formatDate, formatMoney } from '@/utils/format'

type ServiceSortKey = 'type' | 'customer' | 'date' | 'total' | 'payment' | 'status'

export default function ServicesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
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

  const matched = useMemo(
    () => applyFilters(services ?? [], filters, (id) => customerMap.get(id)),
    [services, filters, customerMap],
  )

  const sort = useSort<ServiceSortKey>()
  const filtered = useSorted(matched, sort.key, sort.dir, {
    type: (s) => s.serviceType,
    customer: (s) => customerMap.get(s.customerId)?.name,
    date: (s) => s.serviceDate,
    total: (s) => s.totalAmount,
    payment: (s) => s.paymentStatus,
    status: (s) => s.status,
  })

  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 20)

  const visibleIds = useMemo(() => slice.map((s) => s.id), [slice])
  const selection = useSelection(visibleIds)

  const [bulkBusy, setBulkBusy] = useState(false)

  /** Applies a mutation to each selected row, reporting one summary toast. */
  async function runBulk(label: string, fn: (id: string) => Promise<unknown>) {
    const ids = selection.selectedIds
    if (!ids.length) return
    setBulkBusy(true)
    let done = 0
    const failures: string[] = []
    for (const id of ids) {
      try {
        await fn(id)
        done += 1
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'Unknown error')
      }
    }
    setBulkBusy(false)
    selection.clear()
    if (failures.length) {
      toast.error(`${label} partly failed`, `${done} updated, ${failures.length} failed. ${failures[0]}`)
    } else {
      toast.success(label, `${done} service${done === 1 ? '' : 's'} updated.`)
    }
  }

  async function onBulkDelete() {
    const n = selection.count
    const ok = await confirm({
      title: `Delete ${n} service${n === 1 ? '' : 's'}?`,
      message: `The selected service record${n === 1 ? '' : 's'}, along with ${n === 1 ? 'its' : 'their'} parts and payments, will be permanently deleted. This cannot be undone.`,
      confirmLabel: `Delete ${n} service${n === 1 ? '' : 's'}`,
      danger: true,
    })
    if (!ok) return
    await runBulk('Services deleted', deleteService)
  }

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
              <Download size={14} /> <span className="sr-only sm:not-sr-only">Export CSV</span>
            </button>
            <button className="btn-primary" onClick={() => navigate('/services/new')}>
              <Plus size={14} /> New Service
            </button>
          </>
        }
      />

      {filtered.length > 0 && (
        <div className="mb-3.5 grid grid-cols-3 gap-3">
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

      <div className="panel">
        <ServiceFilters filters={filters} onChange={setFilters} serviceTypes={serviceTypes} />

        <BulkBar count={selection.count} noun="service" onClear={selection.clear}>
          <select
            className="input w-auto py-1.5 text-[12.5px] font-medium"
            value=""
            disabled={bulkBusy}
            onChange={(e) => {
              const next = e.target.value
              if (!next) return
              e.target.value = ''
              void runBulk(`Status set to ${next}`, (id) =>
                setServiceStatus(id, next as (typeof SERVICE_STATUSES)[number]),
              )
            }}
            aria-label="Set status for selected services"
          >
            <option value="">Set status…</option>
            {SERVICE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary text-red-600 hover:border-red-300 hover:bg-red-50"
            onClick={onBulkDelete}
            disabled={bulkBusy}
          >
            <Trash2 size={13} /> Delete
          </button>
        </BulkBar>

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
                <thead>
                  <tr>
                    <th className="table-th w-9">
                      <SelectAllCheckbox
                        checked={selection.allVisibleSelected}
                        indeterminate={selection.someVisibleSelected}
                        onChange={selection.toggleAllVisible}
                        label="Select all services on this page"
                      />
                    </th>
                    <SortableTh label="Service" column="type" active={sort.key} dir={sort.dir} onSort={sort.toggle} />
                    <SortableTh label="Customer" column="customer" active={sort.key} dir={sort.dir} onSort={sort.toggle} />
                    <SortableTh label="Date" column="date" active={sort.key} dir={sort.dir} onSort={sort.toggle} />
                    <th className="table-th">Device</th>
                    <SortableTh label="Total" column="total" active={sort.key} dir={sort.dir} onSort={sort.toggle} align="right" />
                    <SortableTh label="Payment" column="payment" active={sort.key} dir={sort.dir} onSort={sort.toggle} />
                    <SortableTh label="Status" column="status" active={sort.key} dir={sort.dir} onSort={sort.toggle} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {slice.map((s) => {
                    const c = customerMap.get(s.customerId)
                    return (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/services/${s.id}`)}
                        className={`table-row-link ${selection.isSelected(s.id) ? 'bg-brand-50/70' : ''}`}
                      >
                        <td className="table-td" onClick={(e) => e.stopPropagation()}>
                          <RowCheckbox
                            checked={selection.isSelected(s.id)}
                            onChange={() => selection.toggle(s.id)}
                            label={`Select ${s.code}`}
                          />
                        </td>
                        <td className="table-td">
                          <p className="cell-primary">{s.serviceType}</p>
                          <span className="code-chip">{s.code}</span>
                        </td>
                        <td className="table-td">
                          <p className="font-medium text-ink-800">{c?.name ?? 'Unknown'}</p>
                          <p className="text-[12px] cell-muted">{c?.phone ?? ''}</p>
                        </td>
                        <td className="table-td whitespace-nowrap cell-muted">
                          {formatDate(s.serviceDate)}
                        </td>
                        <td className="table-td cell-muted">
                          {[s.product, s.brand].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="table-td text-right font-semibold text-ink-900">
                          {formatMoney(s.totalAmount, settings.currency)}
                          {s.balance > 0 && (
                            <span className="mt-0.5 block text-[11.5px] font-bold text-rose-700">
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

            <ul className="divide-y divide-line-soft lg:hidden">
              {slice.map((s) => {
                const c = customerMap.get(s.customerId)
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/services/${s.id}`)}
                      className="w-full px-3.5 py-3 text-left transition-colors active:bg-brand-50/50"
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
                            <p className="text-[12px] font-bold text-rose-700">
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
    tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-rose-700' : 'text-ink-900'
  return (
    <div className="card px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500">{label}</p>
      <p className={`mt-0.5 truncate text-[15px] font-bold tracking-tight tabular sm:text-[17px] ${color}`}>
        {value}
      </p>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FileText, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import {
  applyFilters,
  EMPTY_FILTERS,
  ServiceFilters,
  type FilterState,
} from '@/components/services/ServiceFilters'
import { DocumentActions } from '@/components/services/DocumentActions'
import { PaymentBadge, StatusBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination, usePagination } from '@/components/ui/Pagination'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useServices, useSettings } from '@/hooks/useData'
import { deleteService } from '@/services/services'
import type { DocKind } from '@/types'
import { formatDate, formatMoney } from '@/utils/format'

export default function ReportsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const services = useServices()
  const customerMap = useCustomerMap()
  const settings = useSettings()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [kind, setKind] = useState<DocKind>('report')

  const serviceTypes = useMemo(
    () => [...new Set((services ?? []).map((s) => s.serviceType))].sort(),
    [services],
  )
  const filtered = useMemo(
    () => applyFilters(services ?? [], filters, (id) => customerMap.get(id)),
    [services, filters, customerMap],
  )
  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 10)

  async function onDelete(id: string, code: string) {
    const ok = await confirm({
      title: 'Delete this service report?',
      message: `Service ${code} and its payment history will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteService(id)
      toast.success('Report deleted', `${code} was removed.`)
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  return (
    <>
      <PageHeader
        title="Service Reports"
        subtitle="Generate, print and share customer copies — reports, invoices and receipts."
        actions={
          <div className="flex rounded-lg border border-ink-300 bg-white p-0.5">
            {(
              [
                ['report', 'Report'],
                ['invoice', 'Invoice'],
                ['receipt', 'Receipt'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  kind === k ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <ServiceFilters filters={filters} onChange={setFilters} serviceTypes={serviceTypes} />

      <div className="card overflow-hidden">
        {!services ? (
          <SkeletonRows rows={5} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={services.length ? 'No reports match your filters' : 'No service reports yet'}
            message={
              services.length
                ? 'Adjust the filters to find the service you are looking for.'
                : 'Create a service record and its report will appear here.'
            }
            action={
              services.length ? (
                <button className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </button>
              ) : (
                <button className="btn-primary" onClick={() => navigate('/services/new')}>
                  New Service
                </button>
              )
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {slice.map((s) => {
                const customer = customerMap.get(s.customerId)
                return (
                  <li key={s.id} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-semibold text-ink-900">
                            {s.serviceType}
                          </span>
                          <span className="text-[12.5px] text-ink-500">{s.code}</span>
                          <StatusBadge status={s.status} />
                          <PaymentBadge status={s.paymentStatus} />
                        </div>
                        <p className="mt-1 text-[13px] text-ink-700">
                          {customer?.name ?? 'Unknown customer'}
                          {customer?.phone ? ` · ${customer.phone}` : ''}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink-500">
                          {formatDate(s.serviceDate)} ·{' '}
                          {formatMoney(s.totalAmount, settings.currency)}
                          {s.balance > 0
                            ? ` · ${formatMoney(s.balance, settings.currency)} due`
                            : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="btn-secondary py-1.5 px-2.5 text-[12.5px]"
                          onClick={() => navigate(`/services/${s.id}`)}
                        >
                          <Eye size={15} /> <span className="hidden sm:inline">Open</span>
                        </button>
                        {customer && (
                          <DocumentActions
                            service={s}
                            customer={customer}
                            settings={settings}
                            kind={kind}
                            compact
                          />
                        )}
                        <button
                          className="btn-secondary py-1.5 px-2.5 text-[12.5px]"
                          onClick={() => navigate(`/services/${s.id}/edit`)}
                        >
                          <Pencil size={15} /> <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          className="btn-secondary py-1.5 px-2.5 text-[12.5px] text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(s.id, s.code)}
                        >
                          <Trash2 size={15} /> <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>
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
              label="reports"
            />
          </>
        )}
      </div>
    </>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ServiceFilters, type FilterState } from '@/components/services/ServiceFilters'
import { applyFilters, EMPTY_FILTERS } from '@/components/services/serviceFiltersHelper'
import { DocumentActions } from '@/components/services/DocumentActions'
import { PaymentBadge, StatusBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/components/ui/usePagination'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useCustomers, useServices, useSettings } from '@/hooks/useData'
import { db } from '@/lib/db'
import { deleteService } from '@/services/services'
import type { Customer, DocKind, Service } from '@/types'
import { formatDate, formatMoney } from '@/utils/format'

type TabKind = DocKind | 'statement'

export default function ReportsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const services = useServices()
  const customers = useCustomers()
  const customerMap = useCustomerMap()
  const settings = useSettings()

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const tabParam = searchParams.get('tab') as TabKind | null
  const [kind, setKind] = useState<TabKind>(
    tabParam === 'statement' || tabParam === 'invoice' || tabParam === 'receipt'
      ? tabParam
      : 'report',
  )

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    searchParams.get('customerId') || '',
  )

  const serviceTypes = useMemo(
    () => [...new Set((services ?? []).map((s) => s.serviceType))].sort(),
    [services],
  )
  const filtered = useMemo(
    () => applyFilters(services ?? [], filters, (id) => customerMap.get(id)),
    [services, filters, customerMap],
  )
  const { page, setPage, pageCount, total, slice, pageSize } = usePagination(filtered, 10)

  // Customer Statement helpers
  const selectedCustomer = useMemo(
    () => (selectedCustomerId ? customerMap.get(selectedCustomerId) : undefined),
    [selectedCustomerId, customerMap],
  )

  const selectedCustomerServices = useMemo(() => {
    if (!selectedCustomerId || !services) return []
    return services
      .filter((s) => s.customerId === selectedCustomerId)
      .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
  }, [selectedCustomerId, services])

  const selectedCustomerStats = useMemo(() => {
    const list = selectedCustomerServices
    const totalBilled = list.reduce((sum, s) => sum + (s.status === 'Cancelled' ? 0 : s.totalAmount), 0)
    const totalPaid = list.reduce((sum, s) => sum + (s.status === 'Cancelled' ? 0 : s.amountPaid), 0)
    const outstanding = Math.max(0, totalBilled - totalPaid)
    return {
      count: list.length,
      totalBilled,
      totalPaid,
      outstanding,
    }
  }, [selectedCustomerServices])

  const matchingCustomers = useMemo(() => {
    if (!customers) return []
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers.slice(0, 15)
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)),
    )
  }, [customers, customerSearch])

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

  async function handleDownloadStatement(c: Customer, custServices: Service[]) {
    try {
      const [custPayments, { downloadCustomerHistory }] = await Promise.all([
        db.payments.where('customerId').equals(c.id).toArray(),
        import('@/pdf/documents'),
      ])
      downloadCustomerHistory({
        customer: c,
        services: custServices,
        payments: custPayments,
        settings,
      })
      toast.success('Statement downloaded', `Full history statement for ${c.name}`)
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'Could not generate PDF.')
    }
  }

  function handleTabChange(nextKind: TabKind) {
    setKind(nextKind)
    const nextParams = new URLSearchParams(searchParams)
    if (nextKind === 'report') nextParams.delete('tab')
    else nextParams.set('tab', nextKind)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Service Reports"
        subtitle="Generate, print and share customer copies — reports, invoices, receipts, and customer history statements."
        actions={
          <div className="flex flex-wrap rounded-lg border border-ink-300 bg-white p-0.5">
            {(
              [
                ['report', 'Report'],
                ['invoice', 'Invoice'],
                ['receipt', 'Receipt'],
                ['statement', 'Customer Statement'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => handleTabChange(k)}
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

      {kind === 'statement' ? (
        /* Customer Statement History View */
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-ink-900">Customer Statement & History</h3>
                <p className="text-[13px] text-ink-500">
                  Select any customer to view their complete service history, billing summary, and download their official statement PDF.
                </p>
              </div>

              {selectedCustomer && (
                <button
                  className="btn-primary"
                  onClick={() => handleDownloadStatement(selectedCustomer, selectedCustomerServices)}
                >
                  <Download size={15} /> Download Statement (PDF)
                </button>
              )}
            </div>

            {/* Customer Search / Picker Bar */}
            <div className="mt-4">
              <label htmlFor="customer-search-input" className="sr-only">Search customer</label>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="customer-search-input"
                  type="text"
                  placeholder="Search customer by name, mobile number, or ID..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="input pl-9 pr-8"
                />
                {customerSearch && (
                  <button
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {selectedCustomer ? (
            /* Selected Customer Details & Statement */
            <div className="space-y-4">
              {/* Profile & KPI Summary */}
              <div className="card p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-[15px] font-bold text-brand-700">
                      {selectedCustomer.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[16px] font-bold text-ink-900">{selectedCustomer.name}</h4>
                        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-700">
                          {selectedCustomer.code}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-600">
                        {selectedCustomer.phone}
                        {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}
                        {selectedCustomer.city ? ` · ${selectedCustomer.city}` : ''}
                      </p>
                      {selectedCustomer.gstNumber && (
                        <p className="text-[12px] text-ink-500">GSTIN: {selectedCustomer.gstNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-secondary text-[13px]"
                      onClick={() => navigate(`/customers/${selectedCustomer.id}`)}
                    >
                      <User size={14} /> View Profile
                    </button>
                    <button
                      className="btn-secondary text-[13px]"
                      onClick={() => setSelectedCustomerId('')}
                    >
                      Change Customer
                    </button>
                  </div>
                </div>

                {/* 4 KPIs */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
                    <p className="text-[12px] font-medium text-ink-500">Total Services</p>
                    <p className="mt-1 text-[18px] font-bold text-ink-900">{selectedCustomerStats.count}</p>
                  </div>
                  <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
                    <p className="text-[12px] font-medium text-ink-500">Total Billed</p>
                    <p className="mt-1 text-[18px] font-bold text-ink-900">
                      {formatMoney(selectedCustomerStats.totalBilled, settings.currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
                    <p className="text-[12px] font-medium text-ink-500">Total Paid</p>
                    <p className="mt-1 text-[18px] font-bold text-emerald-700">
                      {formatMoney(selectedCustomerStats.totalPaid, settings.currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
                    <p className="text-[12px] font-medium text-ink-500">Outstanding Balance</p>
                    <p
                      className={`mt-1 text-[18px] font-bold ${
                        selectedCustomerStats.outstanding > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatMoney(selectedCustomerStats.outstanding, settings.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Services History Table */}
              <div className="panel">
                <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <h4 className="text-[14px] font-semibold text-ink-900">
                    Service Records ({selectedCustomerServices.length})
                  </h4>
                  <button
                    className="btn-secondary py-1 text-[12.5px]"
                    onClick={() => handleDownloadStatement(selectedCustomer, selectedCustomerServices)}
                  >
                    <Download size={14} /> PDF Statement
                  </button>
                </div>

                {selectedCustomerServices.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No service records for this customer yet"
                    message="You can create a new service or still download a statement showing zero balance."
                    action={
                      <button
                        className="btn-primary"
                        onClick={() => navigate(`/services/new?customerId=${selectedCustomer.id}`)}
                      >
                        <Plus size={14} /> New Service
                      </button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {selectedCustomerServices.map((s) => (
                      <li key={s.id} className="p-4 hover:bg-ink-50/50 transition-colors">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14.5px] font-semibold text-ink-900">
                                {s.serviceType}
                              </span>
                              <span className="text-[12.5px] text-ink-500">{s.code}</span>
                              <StatusBadge status={s.status} />
                              <PaymentBadge status={s.paymentStatus} />
                            </div>
                            <p className="mt-1 text-[13px] text-ink-600">
                              Date: {formatDate(s.serviceDate)}
                              {s.product ? ` · Product: ${s.product}` : ''}
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-ink-500">
                              Total: {formatMoney(s.totalAmount, settings.currency)} · Paid:{' '}
                              {formatMoney(s.amountPaid, settings.currency)}
                              {s.balance > 0 ? (
                                <span className="font-medium text-red-600">
                                  {' '}
                                  · Due: {formatMoney(s.balance, settings.currency)}
                                </span>
                              ) : (
                                <span className="text-emerald-600"> · Paid in full</span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="btn-secondary py-1.5 px-2.5 text-[12.5px]"
                              onClick={() => navigate(`/services/${s.id}`)}
                            >
                              <Eye size={14} /> Open
                            </button>
                            <DocumentActions
                              service={s}
                              customer={selectedCustomer}
                              settings={settings}
                              kind="report"
                              compact
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            /* Customer Search / Selection List */
            <div className="panel">
              <div className="border-b border-ink-200 px-4 py-3">
                <h4 className="text-[14px] font-semibold text-ink-900">
                  {customerSearch ? `Matching Customers (${matchingCustomers.length})` : 'All Customers'}
                </h4>
              </div>

              {!customers ? (
                <SkeletonRows rows={5} cols={3} />
              ) : matchingCustomers.length === 0 ? (
                <EmptyState
                  icon={User}
                  title="No customers match your search"
                  message="Try searching with a different name, phone number, or ID."
                  action={
                    customerSearch ? (
                      <button className="btn-secondary" onClick={() => setCustomerSearch('')}>
                        Clear search
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {matchingCustomers.map((c) => {
                    const custServices = (services ?? []).filter((s) => s.customerId === c.id)
                    const totalDue = custServices.reduce(
                      (sum, s) => sum + (s.status === 'Cancelled' ? 0 : s.balance),
                      0,
                    )
                    return (
                      <li key={c.id} className="p-4 hover:bg-ink-50/50 transition-colors">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14.5px] font-semibold text-ink-900">{c.name}</span>
                              <span className="text-[12px] text-ink-500 font-mono">{c.code}</span>
                            </div>
                            <p className="mt-0.5 text-[13px] text-ink-600">
                              Phone: {c.phone}
                              {c.city ? ` · ${c.city}` : ''}
                            </p>
                            <p className="mt-0.5 text-[12px] text-ink-500">
                              {custServices.length} service{custServices.length === 1 ? '' : 's'} recorded
                              {totalDue > 0 ? (
                                <span className="font-semibold text-red-600">
                                  {' '}
                                  · {formatMoney(totalDue, settings.currency)} balance due
                                </span>
                              ) : (
                                <span className="text-emerald-600"> · Clean balance</span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="btn-primary py-1.5 px-3 text-[12.5px]"
                              onClick={() => setSelectedCustomerId(c.id)}
                            >
                              <FileText size={14} /> View History Statement
                            </button>
                            <button
                              className="btn-secondary py-1.5 px-2.5 text-[12.5px]"
                              onClick={() => handleDownloadStatement(c, custServices)}
                              title="Download Statement PDF"
                            >
                              <Download size={14} /> PDF
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Regular Service Reports / Invoices / Receipts Table */
        <div className="panel">
          <ServiceFilters filters={filters} onChange={setFilters} serviceTypes={serviceTypes} />

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
              <ul className="divide-y divide-line-soft">
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
                            <Eye size={15} /> <span className="sr-only sm:not-sr-only">Open</span>
                          </button>
                          {customer && (
                            <DocumentActions
                              service={s}
                              customer={customer}
                              settings={settings}
                              kind={kind as DocKind}
                              compact
                            />
                          )}
                          <button
                            className="btn-secondary py-1.5 px-2.5 text-[12.5px]"
                            onClick={() => navigate(`/services/${s.id}/edit`)}
                          >
                            <Pencil size={15} /> <span className="sr-only sm:not-sr-only">Edit</span>
                          </button>
                          <button
                            className="btn-secondary py-1.5 px-2.5 text-[12.5px] text-red-600 hover:bg-red-50"
                            onClick={() => onDelete(s.id, s.code)}
                          >
                            <Trash2 size={15} /> <span className="sr-only sm:not-sr-only">Delete</span>
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
      )}
    </>
  )
}

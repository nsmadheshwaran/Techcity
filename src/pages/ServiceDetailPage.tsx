import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Lock,
  Pencil,
  Phone,
  Receipt,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { DocumentActions } from '@/components/services/DocumentActions'
import { PaymentModal } from '@/components/services/PaymentModal'
import { PaymentBadge, StatusBadge } from '@/components/ui/Badges'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import {
  useCustomer,
  usePayments,
  useService,
  useServiceParts,
  useSettings,
} from '@/hooks/useData'
import { deletePayment, deleteService, round2, setServiceStatus } from '@/services/services'
import { SERVICE_STATUSES, type DocKind, type ServiceStatus } from '@/types'
import { formatDate, formatDateLong, formatMoney } from '@/utils/format'

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const service = useService(id)
  const customer = useCustomer(service?.customerId)
  const parts = useServiceParts(id)
  const payments = usePayments({ serviceId: id })
  const settings = useSettings()
  const [payOpen, setPayOpen] = useState(false)
  const [docKind, setDocKind] = useState<DocKind>('report')
  const [showSuccess, setShowSuccess] = useState(false)
  const [photoZoom, setPhotoZoom] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      setShowSuccess(true)
      searchParams.delete('created')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const partsTotal = useMemo(() => (parts ?? []).reduce((s, p) => s + p.total, 0), [parts])

  // Buy-vs-sell figures for the internal margin block. Only parts with an
  // entered cost price are counted, so older rows never skew the profit.
  const margin = useMemo(() => {
    const rows = parts ?? []
    const lines: { name: string; qty: number; cost: number; charged: number; profit: number }[] = []
    let costTotal = 0
    let profit = 0
    for (const p of rows) {
      const c = Number(p.costPrice) || 0
      const q = Number(p.quantity) || 1
      const u = Number(p.unitPrice) || 0
      if (c > 0) {
        costTotal += c * q
        const pr = round2((u - c) * q)
        profit = round2(profit + pr)
        lines.push({ name: p.name, qty: q, cost: round2(c * q), charged: round2(u * q), profit: pr })
      }
    }
    return { lines, costTotal: round2(costTotal), profit, withCost: lines.length, total: rows.length }
  }, [parts])

  if (service === undefined) return <LoadingState label="Loading service…" />
  if (!service)
    return (
      <div className="card">
        <EmptyState
          icon={Wrench}
          title="Service not found"
          message="This service record may have been deleted."
          action={
            <Link to="/services" className="btn-primary">
              Back to Services
            </Link>
          }
        />
      </div>
    )

  async function onDelete() {
    if (!service) return
    const ok = await confirm({
      title: 'Delete this service record?',
      message: (
        <>
          Service <strong>{service.code}</strong> ({service.serviceType}) and its payment history
          will be permanently deleted. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteService(service.id)
      toast.success('Service deleted', `${service.code} was removed.`)
      navigate('/services')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  async function changeStatus(status: ServiceStatus) {
    if (!service) return
    try {
      await setServiceStatus(service.id, status)
      toast.success('Status updated', `${service.code} is now “${status}”.`)
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not update status.')
    }
  }

  async function onDeletePayment(paymentId: string, amount: number) {
    const ok = await confirm({
      title: 'Delete this payment?',
      message: `${formatMoney(amount, settings.currency)} will be removed and the balance recalculated.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deletePayment(paymentId)
      toast.success('Payment deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete payment.')
    }
  }

  return (
    <>
      <PageHeader
        back="/services"
        title={service.serviceType}
        subtitle={`${service.code} · ${formatDateLong(service.serviceDate)}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate(`/services/${service.id}/edit`)}>
              <Pencil size={15} /> <span className="hidden sm:inline">Edit</span>
            </button>
            <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={onDelete}>
              <Trash2 size={15} /> <span className="hidden sm:inline">Delete</span>
            </button>
          </>
        }
      />

      {showSuccess && (
        <div className="card mb-4 border-emerald-200 bg-emerald-50/70 p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-emerald-900">
                Service saved successfully
              </p>
              <p className="mt-0.5 text-[13px] text-emerald-800">
                Service ID: <span className="font-semibold">{service.code}</span> — generate the
                customer copy below.
              </p>
              {customer && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <DocumentActions
                    service={service}
                    customer={customer}
                    settings={settings}
                    kind="report"
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="shrink-0 text-[12.5px] font-medium text-emerald-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Status + customer */}
          <section className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={service.status} />
              <PaymentBadge status={service.paymentStatus} />
              {service.technician && (
                <span className="text-[12.5px] text-ink-500">Technician: {service.technician}</span>
              )}
            </div>

            <div className="mt-3">
              <label className="field-label">Update status</label>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                      service.status === s
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {customer && (
              <Link
                to={`/customers/${customer.id}`}
                className="mt-4 flex items-center gap-3 rounded-lg border border-ink-200 p-3 transition-colors hover:bg-ink-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <User size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink-900">{customer.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {customer.phone}
                    </span>
                    <span>· {customer.code}</span>
                  </p>
                </div>
                <span className="shrink-0 text-[12.5px] font-medium text-brand-700">Profile</span>
              </Link>
            )}
          </section>

          {/* Device + work */}
          <section className="card p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Service Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Detail label="Device / Product" value={service.product} />
              <Detail label="Brand" value={service.brand} />
              <Detail label="Model" value={service.model} />
              <Detail label="Serial Number" value={service.serialNumber} />
            </dl>

            <div className="mt-4 space-y-3">
              <Block label="Complaint / Problem Reported" value={service.complaint} />
              <Block label="Diagnosis" value={service.diagnosis} />
              <Block label="Work Performed" value={service.workPerformed} />
              <Block label="Additional Notes" value={service.notes} />
            </div>
          </section>

          {/* Parts */}
          <section className="card">
            <h2 className="border-b border-ink-200 px-4 py-3 text-[15px] font-semibold text-ink-900">
              Parts Replaced
            </h2>
            {!parts?.length ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-500">
                No itemised parts recorded for this service.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-ink-200 bg-ink-50/60">
                      <tr>
                        <th className="table-th">Part</th>
                        <th className="table-th">Photo</th>
                        <th className="table-th text-center">Qty</th>
                        <th className="table-th text-right">Rate</th>
                        <th className="table-th text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {parts.map((p) => (
                        <tr key={p.id}>
                          <td className="table-td">{p.name}</td>
                          <td className="table-td">
                            {p.photoDataUrl ? (
                              <button
                                type="button"
                                onClick={() => setPhotoZoom(p.photoDataUrl ?? null)}
                                className="block h-11 w-11 overflow-hidden rounded-lg border border-ink-200 transition-opacity hover:opacity-80"
                                title="Tap to view the serial number / label"
                                aria-label={`View photo of ${p.name}`}
                              >
                                <img
                                  src={p.photoDataUrl}
                                  alt={`Photo of ${p.name}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <span className="text-ink-300">—</span>
                            )}
                          </td>
                          <td className="table-td text-center">{p.quantity}</td>
                          <td className="table-td text-right">
                            {formatMoney(p.unitPrice, settings.currency)}
                          </td>
                          <td className="table-td text-right font-medium">
                            {formatMoney(p.total, settings.currency)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-ink-50/60">
                        <td className="table-td font-semibold" colSpan={4}>
                          Parts total
                        </td>
                        <td className="table-td text-right font-semibold">
                          {formatMoney(partsTotal, settings.currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {margin.withCost > 0 ? (
                  <div className="border-t border-amber-200 bg-amber-50/70 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-amber-700">
                      <Lock size={11} /> Internal — your cost & profit (never on the customer copy)
                    </p>
                    <ul className="mt-2 space-y-1 text-[12.5px]">
                      {margin.lines.map((l, idx) => (
                        <li key={idx} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-ink-700">
                            {l.name} <span className="text-ink-400">× {l.qty}</span>
                          </span>
                          <span className="shrink-0 text-ink-600">
                            bought {formatMoney(l.cost, settings.currency)} · charged{' '}
                            {formatMoney(l.charged, settings.currency)} ·{' '}
                            <span
                              className={`font-semibold ${
                                l.profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              profit {formatMoney(l.profit, settings.currency)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-amber-200 pt-2 text-[13px]">
                      <span className="font-medium text-ink-700">
                        You paid {formatMoney(margin.costTotal, settings.currency)} → profit{' '}
                        <span
                          className={`font-bold ${
                            margin.profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatMoney(margin.profit, settings.currency)}
                        </span>
                      </span>
                      {margin.withCost < margin.total && (
                        <span className="text-[11.5px] text-amber-600">
                          {margin.total - margin.withCost} part{' '}
                          {margin.total - margin.withCost === 1 ? 'line has' : 'lines have'} no cost
                          price entered and is not counted.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 border-t border-ink-100 px-4 py-2.5 text-[12px] text-ink-400">
                    <Lock size={11} className="text-amber-400" />
                    Tip: enter each part's “my cost” while editing to see what you bought it for
                    versus what the customer was charged.
                  </p>
                )}
              </>
            )}
          </section>

          {/* Payments */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <h2 className="text-[15px] font-semibold text-ink-900">Payment History</h2>
              {service.balance > 0 && (
                <button className="btn-primary py-1.5 text-[12.5px]" onClick={() => setPayOpen(true)}>
                  <CreditCard size={15} /> Record Payment
                </button>
              )}
            </div>
            {!payments?.length ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-500">
                No payments recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Receipt size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink-900">
                        {formatMoney(p.amount, settings.currency)}{' '}
                        <span className="font-normal text-ink-500">via {p.method}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-500">
                        {formatDate(p.date)}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeletePayment(p.id, p.amount)}
                      className="btn-ghost shrink-0 px-2 text-red-600 hover:bg-red-50"
                      aria-label="Delete payment"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Financial Summary</h2>
            <dl className="space-y-2 text-[13.5px]">
              <Row label="Service Charge" value={formatMoney(service.serviceCharge, settings.currency)} />
              <Row label="Parts Cost" value={formatMoney(service.partsCost, settings.currency)} />
              {service.discount > 0 && (
                <Row
                  label="Discount"
                  value={`- ${formatMoney(service.discount, settings.currency)}`}
                />
              )}
              {settings.gstEnabled && service.taxPercent > 0 && (
                <Row
                  label={`Tax (${service.taxPercent}%)`}
                  value={formatMoney(
                    Math.max(0, service.serviceCharge + service.partsCost - service.discount) *
                      (service.taxPercent / 100),
                    settings.currency,
                  )}
                />
              )}
              <div className="flex items-center justify-between border-t border-ink-200 pt-2">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="text-lg font-bold tracking-tight text-ink-900">
                  {formatMoney(service.totalAmount, settings.currency)}
                </dd>
              </div>
              <Row label="Amount Paid" value={formatMoney(service.amountPaid, settings.currency)} />
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  service.balance > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <dt className="font-medium">Balance</dt>
                <dd className="font-bold">{formatMoney(service.balance, settings.currency)}</dd>
              </div>
            </dl>
            {service.balance > 0 && (
              <button className="btn-primary mt-3 w-full" onClick={() => setPayOpen(true)}>
                <CreditCard size={16} /> Record Payment
              </button>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink-900">
              <FileText size={16} className="text-brand-600" /> Customer Copy
            </h2>
            <label className="field-label">Document type</label>
            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {(
                [
                  ['report', 'Report'],
                  ['invoice', 'Invoice'],
                  ['receipt', 'Receipt'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setDocKind(k)}
                  className={`rounded-lg border px-2 py-1.5 text-[12.5px] font-medium transition-colors ${
                    docKind === k
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {customer ? (
              <div className="grid grid-cols-2 gap-2">
                <DocumentActions
                  service={service}
                  customer={customer}
                  settings={settings}
                  kind={docKind}
                />
              </div>
            ) : (
              <p className="text-[13px] text-red-600">
                The linked customer record is missing, so documents cannot be generated.
              </p>
            )}
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500">
              WhatsApp opens with a pre-filled message. Attach the downloaded PDF to send the report
              — automatic PDF sending needs the paid WhatsApp Business API (see README).
            </p>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Warranty & Next Service</h2>
            <dl className="space-y-2 text-[13.5px]">
              <Row label="Warranty" value={service.warrantyPeriod || 'Not applicable'} />
              <Row
                label="Expires"
                value={service.warrantyExpiry ? formatDateLong(service.warrantyExpiry) : '—'}
              />
              <Row
                label="Next Service"
                value={service.nextServiceDate ? formatDateLong(service.nextServiceDate) : 'Not scheduled'}
              />
            </dl>
          </section>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        service={service}
        currency={settings.currency}
      />

      {photoZoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-6 animate-fade-in no-print"
          onClick={() => setPhotoZoom(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Part photo"
        >
          <img
            src={photoZoom}
            alt="Part photo"
            className="max-h-full max-w-full rounded-xl shadow-2xl"
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 text-ink-700 shadow hover:bg-white"
            onClick={() => setPhotoZoom(null)}
            aria-label="Close photo"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 truncate text-[13.5px] font-medium text-ink-900">{value || '—'}</dd>
    </div>
  )
}

function Block({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-ink-50 p-2.5 text-[13.5px] leading-relaxed text-ink-800">
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  )
}

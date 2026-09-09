import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarClock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ScrollText,
  Trash2,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { ServiceTimeline } from '@/components/customers/ServiceTimeline'
import { EquipmentFormModal } from '@/components/equipment/EquipmentFormModal'
import { EquipmentBadge, StatusBadge } from '@/components/ui/Badges'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import {
  useCalls,
  useCustomer,
  useCustomerContacts,
  useCustomerServices,
  useEquipment,
  usePayments,
  useReminders,
  useServicePartsForServiceIds,
  useSettings,
} from '@/hooks/useData'
import { computeStats, deleteCustomer } from '@/services/customers'
import { deleteEquipment } from '@/services/equipment'
import { buildDocument } from '@/pdf/documents'
import {
  formatDate,
  formatDateLong,
  formatMoney,
  initials,
  monthKey,
  monthLabel,
  todayISO,
  toWhatsAppNumber,
} from '@/utils/format'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const customer = useCustomer(id)
  const contacts = useCustomerContacts(id)
  const services = useCustomerServices(id)
  const equipment = useEquipment(id)
  const reminders = useReminders(id)
  const calls = useCalls(id)
  const payments = usePayments({ customerId: id })
  const settings = useSettings()
  const servicePartMap = useServicePartsForServiceIds((services ?? []).map((s) => s.id))
  const [editOpen, setEditOpen] = useState(false)
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [tab, setTab] = useState<
    'contacts' | 'history' | 'timeline' | 'equipment' | 'reminders' | 'calls'
  >('contacts')
  const [showPassword, setShowPassword] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => monthKey(todayISO()))

  const stats = useMemo(() => computeStats(services ?? []), [services])

  // Internal buy-vs-sell rollup: what the shop paid for parts sold/installed
  // for this customer and the resulting profit. Only parts with an entered
  // cost price are counted. `(internal)` figures are never on customer PDFs.
  const marginStats = useMemo(() => {
    const partsBy = servicePartMap ?? new Map()
    let paid = 0
    let profit = 0
    let withCost = 0
    let totalLines = 0
    for (const s of services ?? []) {
      for (const p of partsBy.get(s.id) ?? []) {
        totalLines += 1
        const c = Number(p.costPrice) || 0
        const q = Number(p.quantity) || 1
        if (c > 0) {
          withCost += 1
          paid += c * q
          profit += ((Number(p.unitPrice) || 0) - c) * q
        }
      }
    }
    return { paid, profit, withCost, totalLines }
  }, [services, servicePartMap])

  const serviceMargins = useMemo(() => {
    const partsBy = servicePartMap ?? new Map()
    const map = new Map<string, { paid: number; profit: number }>()
    for (const s of services ?? []) {
      let paid = 0
      let profit = 0
      let hasCost = false
      for (const p of partsBy.get(s.id) ?? []) {
        const c = Number(p.costPrice) || 0
        const q = Number(p.quantity) || 1
        if (c > 0) {
          hasCost = true
          paid += c * q
          profit += ((Number(p.unitPrice) || 0) - c) * q
        }
      }
      if (hasCost) map.set(s.id, { paid, profit })
    }
    return map
  }, [services, servicePartMap])

  const monthlyServices = useMemo(() => {
    return (services ?? []).filter((s) => monthKey(s.serviceDate) === reportMonth)
  }, [services, reportMonth])

  const monthlyTotal = useMemo(
    () => monthlyServices.reduce((sum, s) => (s.status === 'Cancelled' ? sum : sum + s.totalAmount), 0),
    [monthlyServices],
  )

  const monthlyMonths = useMemo(() => {
    const set = new Set<string>()
    set.add(monthKey(todayISO()))
    for (const s of services ?? []) set.add(monthKey(s.serviceDate))
    return [...set].sort().reverse()
  }, [services])

  if (customer === undefined) return <LoadingState label="Loading customer…" />
  if (customer === null || !customer)
    return (
      <div className="card">
        <EmptyState
          icon={Wrench}
          title="Customer not found"
          message="This customer may have been deleted. Return to the customer list to continue."
          action={
            <Link to="/customers" className="btn-primary">
              Back to Customers
            </Link>
          }
        />
      </div>
    )

  async function onDelete() {
    if (!customer) return
    const ok = await confirm({
      title: 'Delete this customer?',
      message: (
        <>
          <strong>{customer.name}</strong> and all related records ({services?.length ?? 0} service
          {(services?.length ?? 0) === 1 ? '' : 's'}, payments, equipment and reminders) will be
          permanently deleted. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCustomer(customer.id)
      toast.success('Customer deleted', `${customer.name} was removed.`)
      navigate('/customers')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete customer.')
    }
  }

  async function onDeleteEquipment(eqId: string, label: string) {
    const ok = await confirm({
      title: 'Delete equipment record?',
      message: `${label} will be removed from this customer.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteEquipment(eqId)
      toast.success('Equipment deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  async function downloadHistory() {
    if (!customer) return
    try {
      const custPayments = payments ?? []
      const doc = buildDocument({
        kind: 'history',
        service: {
          ...({
            code: customer.code,
            serviceDate: customer.dateAdded,
            serviceType: 'Customer History',
            status: 'Completed',
            serviceMode: 'Offline',
            complaint: '',
            serviceCharge: 0,
            partsCost: 0,
            discount: 0,
            taxPercent: 0,
            totalAmount: stats.totalSpent,
            amountPaid: stats.totalPaid,
            balance: stats.outstanding,
            paymentStatus: 'Paid',
          } as any),
        } as any,
        customer,
        parts: [],
        payments: custPayments,
        settings,
      })
      doc.save(`CustomerHistory-${customer.code}-${customer.name.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`)
      toast.success('History downloaded', `Full history for ${customer.name}`)
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'Could not generate PDF.')
    }
  }

  const waNumber = toWhatsAppNumber(customer.phone)
  const primaryContacts = contacts ?? []

  return (
    <>
      <PageHeader
        back="/customers"
        title={customer.name}
        subtitle={`${customer.code} · Customer since ${formatDate(customer.dateAdded)}`}
        actions={
          <>
            <button className="btn-secondary" onClick={downloadHistory} disabled={!services?.length}>
              <Download size={15} /> <span className="hidden sm:inline">History</span>
            </button>
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> <span className="hidden sm:inline">Edit</span>
            </button>
            <Link className="btn-secondary" to={`/quotations/new?customerId=${customer.id}`}>
              <ScrollText size={15} /> <span className="hidden sm:inline">Quotation</span>
            </Link>
            <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={onDelete}>
              <Trash2 size={15} /> <span className="hidden sm:inline">Delete</span>
            </button>
            <Link className="btn-primary" to={`/services/new?customerId=${customer.id}`}>
              <Plus size={16} /> New Service
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: profile + summary */}
        <div className="space-y-4">
          <section className="card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
                {initials(customer.name)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold text-ink-900">{customer.name}</h2>
                <p className="text-[12.5px] text-ink-500">{customer.code}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 text-[13.5px]">
              <div className="flex items-start gap-2.5">
                <Phone size={15} className="mt-0.5 shrink-0 text-ink-400" />
                <dd className="min-w-0">
                  <a href={`tel:${customer.phone}`} className="font-medium text-ink-900 hover:text-brand-700">
                    {customer.phone}
                  </a>
                  {customer.altPhone && (
                    <span className="block text-[12.5px] text-ink-500">Alt: {customer.altPhone}</span>
                  )}
                </dd>
              </div>
              {customer.email && (
                <div className="flex items-start gap-2.5">
                  <Mail size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <dd className="min-w-0 break-all">
                    <a href={`mailto:${customer.email}`} className="text-ink-800 hover:text-brand-700">
                      {customer.email}
                    </a>
                  </dd>
                </div>
              )}
              {customer.gstNumber && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-ink-400">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>
                  </span>
                  <dd className="text-ink-700">GST: {customer.gstNumber}</dd>
                </div>
              )}
              {customer.complaintDate && (
                <div className="flex items-start gap-2.5">
                  <CalendarClock size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <dd className="text-ink-700">
                    Complaint attended: {formatDateLong(customer.complaintDate)}
                  </dd>
                </div>
              )}
              {(customer.amcType || customer.amcStartDate || customer.amcYears) && (
                <div className="flex items-start gap-2.5">
                  <CalendarClock size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <dd className="text-ink-700">
                    AMC: {customer.amcType || 'Contract'}
                    {customer.amcYears ? ` · ${customer.amcYears} yr${customer.amcYears > 1 ? 's' : ''}` : ''}
                    {customer.amcStartDate ? ` · from ${formatDate(customer.amcStartDate)}` : ''}
                    {customer.amcExpiry ? ` till ${formatDate(customer.amcExpiry)}` : ''}
                  </dd>
                </div>
              )}
              {(customer.address || customer.city) && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <dd className="text-ink-700">
                    {[customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}
              {customer.password && (
                <div className="flex items-start gap-2.5">
                  <Lock size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <dd className="flex items-center gap-2">
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 text-[12px] text-ink-700">
                      {showPassword ? customer.password : '••••••••'}
                    </code>
                    <button
                      onClick={() => setShowPassword((s) => !s)}
                      className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </dd>
                </div>
              )}
            </dl>

            {customer.notes && (
              <p className="mt-3 rounded-lg bg-ink-50 p-2.5 text-[12.5px] leading-relaxed text-ink-600">
                {customer.notes}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${customer.phone}`} className="btn-secondary">
                <Phone size={15} /> Call
              </a>
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            </div>
          </section>

          <section className="card">
            <h3 className="border-b border-ink-200 px-4 py-3 text-[15px] font-semibold text-ink-900">
              Service Summary
            </h3>
            <dl className="divide-y divide-ink-100">
              <SummaryRow label="Total Services" value={String(stats.totalServices)} />
              <SummaryRow
                label="Total Amount Spent"
                value={formatMoney(stats.totalSpent, settings.currency)}
              />
              <SummaryRow
                label="Amount Paid"
                value={formatMoney(stats.totalPaid, settings.currency)}
              />
              <SummaryRow
                label="Outstanding Payment"
                value={formatMoney(stats.outstanding, settings.currency)}
                tone={stats.outstanding > 0 ? 'danger' : 'success'}
              />
              <SummaryRow
                label="Last Service"
                value={stats.lastServiceDate ? formatDateLong(stats.lastServiceDate) : '—'}
              />
              <SummaryRow
                label="Next Service"
                value={stats.nextServiceDate ? formatDateLong(stats.nextServiceDate) : 'Not scheduled'}
                tone={stats.nextServiceDate ? 'brand' : undefined}
              />
              {marginStats.withCost > 0 && (
                <>
                  <SummaryRow
                    label="You paid for parts (internal)"
                    value={formatMoney(marginStats.paid, settings.currency)}
                  />
                  <SummaryRow
                    label="Profit on parts (internal)"
                    value={formatMoney(marginStats.profit, settings.currency)}
                    tone={marginStats.profit >= 0 ? 'success' : 'danger'}
                  />
                  {marginStats.withCost < marginStats.totalLines && (
                    <p className="flex items-center gap-1 border-t border-ink-100 px-4 py-2 text-[11px] leading-relaxed text-amber-600">
                      <Lock size={10} className="shrink-0" />
                      {marginStats.totalLines - marginStats.withCost} part{
                        marginStats.totalLines - marginStats.withCost === 1 ? '' : 's'
                      }{
                        marginStats.totalLines - marginStats.withCost === 1
                          ? ' has no cost price entered'
                          : ' have no cost price entered'
                      }{
                        ' '}
                      and is not counted.
                    </p>
                  )}
                </>
              )}
            </dl>
          </section>

          {/* Monthly report */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <h3 className="text-[15px] font-semibold text-ink-900">Monthly Report</h3>
              <select
                className="input w-auto py-1.5 text-[13px]"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                aria-label="Select month"
              >
                {monthlyMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            {monthlyServices.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-ink-500">
                No services in {monthLabel(reportMonth)}.
              </div>
            ) : (
              <>
                <ul className="divide-y divide-ink-100">
                  {monthlyServices.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/services/${s.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-ink-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink-900">
                            {s.serviceType}
                          </p>
                          <p className="text-[12px] text-ink-500">
                            {formatDate(s.serviceDate)} · {s.serviceMode}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13.5px] font-semibold text-ink-900">
                            {formatMoney(s.totalAmount, settings.currency)}
                          </p>
                          <StatusBadge status={s.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
                  <span className="text-[13px] font-medium text-ink-600">
                    {monthlyServices.length} service(s)
                  </span>
                  <span className="text-[15px] font-bold text-ink-900">
                    {formatMoney(monthlyTotal, settings.currency)}
                  </span>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex overflow-x-auto border-b border-ink-200">
              {(
                [
                  ['contacts', `Contacts (${primaryContacts.length})`],
                  ['history', `Service History (${services?.length ?? 0})`],
                  ['timeline', 'Timeline'],
                  ['equipment', `Equipment (${equipment?.length ?? 0})`],
                  ['reminders', `Reminders (${(reminders ?? []).filter((r) => !r.done).length})`],
                  ['calls', `Calls (${calls?.length ?? 0})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 text-[13.5px] font-medium transition-colors ${
                    tab === key
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-ink-500 hover:text-ink-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'contacts' && (
              <>
                {primaryContacts.length === 0 ? (
                  <EmptyState
                    icon={Phone}
                    title="No contacts added"
                    message="Add the owner, manager, and other people associated with this customer."
                  />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {primaryContacts.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
                          {initials(c.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-ink-900">
                            {c.name}
                            {c.role && (
                              <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
                                {c.role}
                              </span>
                            )}
                          </p>
                          <a href={`tel:${c.phone}`} className="text-[13px] text-ink-600 hover:text-brand-700">
                            {c.phone}
                          </a>
                        </div>
                        <a
                          href={`https://wa.me/${toWhatsAppNumber(c.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost px-2 text-emerald-700 hover:bg-emerald-50"
                          aria-label={`WhatsApp ${c.name}`}
                        >
                          <MessageCircle size={16} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'history' &&
              (!services?.length ? (
                <EmptyState
                  icon={Wrench}
                  title="No services yet"
                  message="Record the first service for this customer to build their history."
                  action={
                    <Link className="btn-primary" to={`/services/new?customerId=${customer.id}`}>
                      <Plus size={16} /> New Service
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {services.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/services/${s.id}`}
                        className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                          <Wrench size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[14px] font-semibold text-ink-900">{s.serviceType}</p>
                            <StatusBadge status={s.status} />
                            <span className="badge border-ink-200 bg-ink-100 text-ink-600">
                              {s.serviceMode}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-500">
                            {formatDate(s.serviceDate)} · {s.code}
                            {s.product ? ` · ${s.product}` : ''}
                            {s.brand ? ` ${s.brand}` : ''}
                          </p>
                          <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-600">{s.complaint}</p>
                          {(() => {
                            const m = serviceMargins.get(s.id)
                            return m ? (
                              <p
                                className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700"
                                title={`Bought for ${formatMoney(m.paid, settings.currency)}, charged ${formatMoney(s.totalAmount, settings.currency)}`}
                              >
                                <Lock size={9} />
                                {formatMoney(m.profit, settings.currency)} profit (internal)
                              </p>
                            ) : null
                          })()}
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
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === 'timeline' &&
              (!services?.length ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Nothing on the timeline"
                  message="Once services are recorded they will appear here in chronological order."
                />
              ) : (
                <ServiceTimeline services={services} currency={settings.currency} />
              ))}

            {tab === 'equipment' && (
              <>
                <div className="flex justify-end border-b border-ink-100 px-4 py-2.5">
                  <button className="btn-secondary py-1.5" onClick={() => setEquipmentOpen(true)}>
                    <Plus size={15} /> Add Equipment
                  </button>
                </div>
                {!equipment?.length ? (
                  <EmptyState
                    icon={HardDrive}
                    title="No equipment recorded"
                    message="Track cameras, DVRs, computers and other devices installed for this customer."
                    action={
                      <button className="btn-primary" onClick={() => setEquipmentOpen(true)}>
                        <Plus size={16} /> Add Equipment
                      </button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {equipment.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 px-4 py-3.5">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                          <HardDrive size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-semibold text-ink-900">
                              {e.productType}
                              {e.brand ? ` · ${e.brand}` : ''}
                            </p>
                            <EquipmentBadge status={e.status} />
                          </div>
                          <p className="mt-0.5 text-[12.5px] text-ink-600">
                            {[e.model, e.serialNumber && `SN: ${e.serialNumber}`, e.location]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="mt-0.5 text-[12px] text-ink-500">
                            {e.installationDate ? `Installed: ${formatDate(e.installationDate)}` : ''}
                            {e.warrantyPeriod ? ` · Warranty: ${e.warrantyPeriod}` : ''}
                            {e.warrantyExpiry ? ` (till ${formatDate(e.warrantyExpiry)})` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteEquipment(e.id, `${e.productType} ${e.brand ?? ''}`)}
                          className="btn-ghost shrink-0 px-2 text-red-600 hover:bg-red-50"
                          aria-label="Delete equipment"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'calls' &&
              (!calls?.length ? (
                <EmptyState
                  icon={Phone}
                  title="No calls logged"
                  message="Log enquiries for this customer in the Call Log — online, direct or demo."
                  action={
                    <Link to="/calls" className="btn-primary">
                      Open Call Log
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {calls.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                        <Phone size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-[14px] font-semibold text-ink-900">{c.name}</p>
                          <span className="badge border-brand-100 bg-brand-50 text-brand-700">
                            {c.source}
                          </span>
                          {c.priority && (
                            <span
                              className={`badge ${
                                c.priority === 'P1'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : c.priority === 'P2'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-sky-200 bg-sky-50 text-sky-700'
                              }`}
                            >
                              {c.priority}
                            </span>
                          )}
                          <span className="badge border-ink-200 bg-ink-100 text-ink-600">
                            {c.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink-500">
                          {formatDate(c.date)}
                          {c.phone ? ` · ${c.phone}` : ''}
                        </p>
                        {c.issue && (
                          <p className="mt-1 rounded bg-ink-50 px-2 py-1 text-[12px] text-ink-700">
                            {c.issue}
                          </p>
                        )}
                        {c.notes && (
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">{c.notes}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {c.status !== 'Completed' && (
                            <Link
                              to={`/services/new?callId=${c.id}&customerId=${customer.id}`}
                              className="btn-primary py-1.5 text-[12.5px]"
                            >
                              <Wrench size={13} /> Book Service
                            </Link>
                          )}
                          <Link to="/calls" className="btn-ghost px-2 py-1.5 text-[12.5px]">
                            Open Call Book
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === 'reminders' &&
              (!reminders?.length ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No reminders"
                  message="Reminders are created automatically when you set a next service date or warranty on a service."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {reminders.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          r.done ? 'bg-ink-300' : 'bg-brand-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[13.5px] font-medium ${
                            r.done ? 'text-ink-400 line-through' : 'text-ink-900'
                          }`}
                        >
                          {r.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-500">
                          {r.type} · Due {formatDateLong(r.dueDate)}
                        </p>
                      </div>
                      {r.serviceId && (
                        <Link
                          to={`/services/${r.serviceId}`}
                          className="btn-ghost shrink-0 px-2 py-1 text-[12.5px]"
                        >
                          View
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          {stats.outstanding > 0 && (
            <div className="card mt-4 flex items-center gap-3 border-red-200 bg-red-50/60 p-4">
              <CreditCard size={18} className="shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-red-800">
                  Outstanding balance: {formatMoney(stats.outstanding, settings.currency)}
                </p>
                <p className="text-[12.5px] text-red-700">
                  Open a service below to record a payment.
                </p>
              </div>
              <Link to="/payments?filter=pending" className="btn-secondary shrink-0">
                Payments
              </Link>
            </div>
          )}
        </div>
      </div>

      <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
      <EquipmentFormModal
        open={equipmentOpen}
        onClose={() => setEquipmentOpen(false)}
        defaultCustomerId={customer.id}
      />
    </>
  )
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger' | 'success' | 'brand'
}) {
  const color =
    tone === 'danger'
      ? 'text-red-600'
      : tone === 'success'
        ? 'text-emerald-700'
        : tone === 'brand'
          ? 'text-brand-700'
          : 'text-ink-900'
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className={`text-right text-[13.5px] font-semibold ${color}`}>{value}</dd>
    </div>
  )
}

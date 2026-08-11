import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarClock,
  CreditCard,
  HardDrive,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
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
  useCustomer,
  useCustomerServices,
  useEquipment,
  useReminders,
  useSettings,
} from '@/hooks/useData'
import { computeStats, deleteCustomer } from '@/services/customers'
import { deleteEquipment } from '@/services/equipment'
import { formatDate, formatDateLong, formatMoney, initials, toWhatsAppNumber } from '@/utils/format'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const customer = useCustomer(id)
  const services = useCustomerServices(id)
  const equipment = useEquipment(id)
  const reminders = useReminders(id)
  const settings = useSettings()
  const [editOpen, setEditOpen] = useState(false)
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [tab, setTab] = useState<'history' | 'timeline' | 'equipment' | 'reminders'>('history')

  const stats = useMemo(() => computeStats(services ?? []), [services])

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

  const waNumber = toWhatsAppNumber(customer.phone)

  return (
    <>
      <PageHeader
        back="/customers"
        title={customer.name}
        subtitle={`${customer.code} · Customer since ${formatDate(customer.dateAdded)}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> <span className="hidden sm:inline">Edit</span>
            </button>
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
              {(customer.address || customer.city) && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <dd className="text-ink-700">
                    {[customer.address, customer.city, customer.pincode].filter(Boolean).join(', ')}
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
            </dl>
          </section>
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex overflow-x-auto border-b border-ink-200">
              {(
                [
                  ['history', `Service History (${services?.length ?? 0})`],
                  ['timeline', 'Timeline'],
                  ['equipment', `Equipment (${equipment?.length ?? 0})`],
                  ['reminders', `Reminders (${(reminders ?? []).filter((r) => !r.done).length})`],
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
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-500">
                            {formatDate(s.serviceDate)} · {s.code}
                            {s.product ? ` · ${s.product}` : ''}
                            {s.brand ? ` ${s.brand}` : ''}
                          </p>
                          <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-600">{s.complaint}</p>
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

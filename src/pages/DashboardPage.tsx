import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CreditCard,
  FileText,
  IndianRupee,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { useGlobalSearch } from '@/components/GlobalSearch'
import {
  useCustomerMap,
  useCustomers,
  useReminders,
  useServices,
  useSettings,
} from '@/hooks/useData'
import { daysUntil, dueLabel, formatDate, formatDateLong, formatMoney, monthKey, todayISO } from '@/utils/format'

type RangeKey = 'thisMonth' | 'last30' | 'last90' | 'thisYear' | 'all'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'thisMonth', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last90', label: 'Last 90 days' },
  { key: 'thisYear', label: 'This year' },
  { key: 'all', label: 'All time' },
]

function rangeStart(key: RangeKey): string {
  const now = new Date()
  switch (key) {
    case 'thisMonth':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    case 'last30': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return d.toISOString().slice(0, 10)
    }
    case 'last90': {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      return d.toISOString().slice(0, 10)
    }
    case 'thisYear':
      return `${now.getFullYear()}-01-01`
    default:
      return '0000-01-01'
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const customers = useCustomers()
  const services = useServices()
  const reminders = useReminders()
  const customerMap = useCustomerMap()
  const settings = useSettings()
  const [range, setRange] = useState<RangeKey>('thisMonth')
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const globalSearch = useGlobalSearch()

  const loading = !customers || !services

  const stats = useMemo(() => {
    const all = (services ?? []).filter((s) => s.status !== 'Cancelled')
    const from = rangeStart(range)
    const today = todayISO()
    const inRange = all.filter((s) => s.serviceDate >= from && s.serviceDate <= today)
    const thisMonth = all.filter((s) => monthKey(s.serviceDate) === monthKey(today))

    const pendingStatuses = ['Received', 'Diagnosis', 'In Progress', 'Waiting for Parts', 'Ready']
    const pending = all.filter((s) => pendingStatuses.includes(s.status))

    const upcoming = all
      .filter((s) => {
        const d = daysUntil(s.nextServiceDate)
        return d !== null && d >= 0 && d <= 30
      })
      .sort((a, b) => (a.nextServiceDate ?? '').localeCompare(b.nextServiceDate ?? ''))

    const warrantyExpiring = all
      .filter((s) => {
        const d = daysUntil(s.warrantyExpiry)
        return d !== null && d >= 0 && d <= 30
      })
      .sort((a, b) => (a.warrantyExpiry ?? '').localeCompare(b.warrantyExpiry ?? ''))

    const revenueInRange = inRange.reduce((sum, s) => sum + s.amountPaid, 0)
    const billedInRange = inRange.reduce((sum, s) => sum + s.totalAmount, 0)
    const outstanding = all.reduce((sum, s) => sum + Math.max(0, s.balance), 0)
    const pendingPaymentCount = all.filter((s) => s.balance > 0).length

    const newCustomers = (customers ?? []).filter((c) => c.dateAdded >= from).length

    return {
      totalCustomers: customers?.length ?? 0,
      newCustomers,
      servicesInRange: inRange.length,
      thisMonthCount: thisMonth.length,
      totalServices: all.length,
      pending,
      upcoming,
      warrantyExpiring,
      revenueInRange,
      billedInRange,
      outstanding,
      pendingPaymentCount,
      recent: [...all]
        .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    }
  }, [services, customers, range])

  const dueReminders = useMemo(
    () =>
      (reminders ?? [])
        .filter((r) => !r.done && (daysUntil(r.dueDate) ?? 999) <= 7)
        .slice(0, 6),
    [reminders],
  )

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? ''

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${settings.name} — business overview`}
        actions={
          <select
            className="input w-auto py-1.5 text-[13px]"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            aria-label="Date range"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        }
      />

      {/* Quick actions */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button className="btn-primary py-2.5" onClick={() => setAddCustomerOpen(true)}>
          <UserPlus size={16} /> Add Customer
        </button>
        <button className="btn-secondary py-2.5" onClick={() => navigate('/services/new')}>
          <Plus size={16} /> New Service
        </button>
        <button className="btn-secondary py-2.5" onClick={() => navigate('/reports')}>
          <FileText size={16} /> Generate Report
        </button>
        <button className="btn-secondary py-2.5" onClick={globalSearch.open}>
          <Search size={16} /> Search Customer
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="card mb-5">
          <SkeletonRows rows={3} cols={4} />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            tone="brand"
            hint={`${stats.newCustomers} added · ${rangeLabel.toLowerCase()}`}
            to="/customers"
          />
          <StatCard
            label={`Services (${rangeLabel})`}
            value={stats.servicesInRange}
            icon={Wrench}
            tone="brand"
            hint={`${stats.totalServices} total records`}
            to="/services"
          />
          <StatCard
            label="Pending Services"
            value={stats.pending.length}
            icon={AlertTriangle}
            tone={stats.pending.length ? 'warning' : 'neutral'}
            hint="Not yet completed"
            to="/services?status=pending"
          />
          <StatCard
            label="Upcoming Maintenance"
            value={stats.upcoming.length}
            icon={CalendarClock}
            tone={stats.upcoming.length ? 'brand' : 'neutral'}
            hint="Next 30 days"
            to="/reminders"
          />
          <StatCard
            label="Warranty Expiring"
            value={stats.warrantyExpiring.length}
            icon={ShieldCheck}
            tone={stats.warrantyExpiring.length ? 'warning' : 'neutral'}
            hint="Next 30 days"
            to="/reminders?type=warranty"
          />
          <StatCard
            label={`Revenue (${rangeLabel})`}
            value={formatMoney(stats.revenueInRange, settings.currency)}
            icon={IndianRupee}
            tone="success"
            hint={`${formatMoney(stats.billedInRange, settings.currency)} billed`}
            to="/payments"
          />
          <StatCard
            label="Pending Payments"
            value={formatMoney(stats.outstanding, settings.currency)}
            icon={CreditCard}
            tone={stats.outstanding > 0 ? 'danger' : 'success'}
            hint={`${stats.pendingPaymentCount} service(s) with balance`}
            to="/payments?filter=pending"
          />
          <StatCard
            label="Services This Month"
            value={stats.thisMonthCount}
            icon={CalendarClock}
            tone="neutral"
            hint={formatDate(todayISO())}
            to="/services"
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Recent services */}
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink-900">Recent Services</h2>
            <Link to="/services" className="text-[13px] font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>

          {loading ? (
            <SkeletonRows rows={5} cols={4} />
          ) : stats.recent.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No services yet"
              message="Create your first service record to get started."
              action={
                <button className="btn-primary" onClick={() => navigate('/services/new')}>
                  <Plus size={16} /> New Service
                </button>
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full">
                  <thead className="border-b border-ink-200 bg-ink-50/60">
                    <tr>
                      <th className="table-th">Customer</th>
                      <th className="table-th">Service</th>
                      <th className="table-th">Date</th>
                      <th className="table-th text-right">Amount</th>
                      <th className="table-th">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {stats.recent.map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer transition-colors hover:bg-ink-50"
                        onClick={() => navigate(`/services/${s.id}`)}
                      >
                        <td className="table-td">
                          <span className="font-medium text-ink-900">
                            {customerMap.get(s.customerId)?.name ?? 'Unknown'}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-ink-500">{s.code}</span>
                        </td>
                        <td className="table-td">{s.serviceType}</td>
                        <td className="table-td whitespace-nowrap text-ink-600">
                          {formatDate(s.serviceDate)}
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
                          <StatusBadge status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-ink-100 sm:hidden">
                {stats.recent.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/services/${s.id}`)}
                      className="w-full px-4 py-3 text-left transition-colors active:bg-ink-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {customerMap.get(s.customerId)?.name ?? 'Unknown'}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] text-ink-600">{s.serviceType}</p>
                          <p className="mt-1 text-[12px] text-ink-500">
                            {formatDate(s.serviceDate)} · {s.code}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-ink-900">
                            {formatMoney(s.totalAmount, settings.currency)}
                          </p>
                          <div className="mt-1.5">
                            <StatusBadge status={s.status} />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Right column */}
        <div className="space-y-4">
          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <h2 className="text-[15px] font-semibold text-ink-900">Upcoming Maintenance</h2>
              <Link to="/reminders" className="text-[13px] font-medium text-brand-700 hover:underline">
                All
              </Link>
            </div>
            {loading ? (
              <SkeletonRows rows={3} cols={2} />
            ) : stats.upcoming.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-ink-500">
                No maintenance scheduled in the next 30 days.
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {stats.upcoming.slice(0, 5).map((s) => {
                  const c = customerMap.get(s.customerId)
                  const d = daysUntil(s.nextServiceDate) ?? 0
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/services/${s.id}`}
                        className="block px-4 py-3 transition-colors hover:bg-ink-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {c?.name ?? 'Unknown'}
                          </p>
                          <span
                            className={`badge shrink-0 ${
                              d <= 7
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-ink-200 bg-ink-100 text-ink-600'
                            }`}
                          >
                            {dueLabel(s.nextServiceDate)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[13px] text-ink-600">{s.serviceType}</p>
                        <p className="mt-1 text-[12px] text-ink-500">
                          Due: {formatDateLong(s.nextServiceDate)}
                        </p>
                        {c?.phone && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-ink-500">
                            <Phone size={11} /> {c.phone}
                          </p>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
                <Bell size={15} className="text-brand-600" /> Reminders
              </h2>
              <Link to="/reminders" className="text-[13px] font-medium text-brand-700 hover:underline">
                All
              </Link>
            </div>
            {dueReminders.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-ink-500">
                Nothing due in the next 7 days.
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {dueReminders.map((r) => {
                  const overdue = (daysUntil(r.dueDate) ?? 0) < 0
                  const c = customerMap.get(r.customerId)
                  return (
                    <li key={r.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-ink-900">{c?.name ?? '—'}</p>
                        <span
                          className={`badge shrink-0 ${
                            overdue
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {dueLabel(r.dueDate)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-ink-600">{r.title}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <CustomerFormModal
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        onSaved={(c) => navigate(`/customers/${c.id}`)}
      />
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  IndianRupee,
  PhoneCall,
  Plus,
  ScrollText,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { useGlobalSearch } from '@/components/SearchContext'
import {
  useCustomerMap,
  useCustomers,
  useReminders,
  useServices,
  useSettings,
} from '@/hooks/useData'
import {
  daysUntil,
  dueLabel,
  formatDate,
  formatMoney,
  monthKey,
  todayISO,
} from '@/utils/format'

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
        subtitle={`${settings.name} — operations overview`}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] font-semibold text-ink-500 sm:inline-block">Period</span>
            <select
              className="input w-auto py-1.5 text-[12.5px] font-semibold"
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
          </div>
        }
      />

      {/* Quick Actions Bar */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <button className="btn-primary" onClick={() => setAddCustomerOpen(true)}>
          <UserPlus size={14} /> Add Customer
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate('/services/new')}
        >
          <Plus size={14} /> New Service
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate('/calls')}
        >
          <PhoneCall size={14} /> Book Call
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate('/quotations/new')}
        >
          <ScrollText size={14} /> New Quote
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate('/reports')}
        >
          <FileText size={14} /> Reports
        </button>
        <button
          className="btn-secondary"
          onClick={globalSearch.open}
        >
          <Search size={14} /> Search
        </button>
      </div>

      {/* Primary KPI Stat Cards */}
      {loading ? (
        <div className="card mb-4 p-4">
          <SkeletonRows rows={3} cols={4} />
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label={`Revenue (${rangeLabel})`}
            value={formatMoney(stats.revenueInRange, settings.currency)}
            icon={IndianRupee}
            tone="success"
            hint={`${formatMoney(stats.billedInRange, settings.currency)} total billed`}
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
            label="Active Services"
            value={stats.pending.length}
            icon={Wrench}
            tone={stats.pending.length ? 'warning' : 'neutral'}
            hint="Jobs currently in workshop"
            to="/services?status=pending"
          />
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            tone="brand"
            hint={`${stats.newCustomers} added ${rangeLabel.toLowerCase()}`}
            to="/customers"
          />
          <StatCard
            label={`Services Done (${rangeLabel})`}
            value={stats.servicesInRange}
            icon={CheckCircle2}
            tone="brand"
            hint={`${stats.totalServices} lifetime job records`}
            to="/services"
          />
          <StatCard
            label="Upcoming Maintenance"
            value={stats.upcoming.length}
            icon={CalendarClock}
            tone={stats.upcoming.length ? 'brand' : 'neutral'}
            hint="Due in next 30 days"
            to="/reminders"
          />
          <StatCard
            label="Expiring Warranties"
            value={stats.warrantyExpiring.length}
            icon={ShieldAlert}
            tone={stats.warrantyExpiring.length ? 'warning' : 'neutral'}
            hint="Next 30 days follow-up"
            to="/reminders?type=warranty"
          />
          <StatCard
            label="Volume This Month"
            value={stats.thisMonthCount}
            icon={CalendarClock}
            tone="neutral"
            hint={formatDate(todayISO())}
            to="/services"
          />
        </div>
      )}

      {/* Main CRM Grid: Recent Services & Action Attention Hub */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Recent services pipeline */}
        <section className="panel xl:col-span-2">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Recent Services</h2>
              <p className="mt-0.5 text-[11.5px] normal-case tracking-normal text-ink-500">
                Live service progress and billing status
              </p>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800 hover:underline"
            >
              View all services <ArrowUpRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="p-4">
              <SkeletonRows rows={5} cols={4} />
            </div>
          ) : stats.recent.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No services yet"
              message="Create your first service job sheet to track status and invoices."
              action={
                <button className="btn-primary" onClick={() => navigate('/services/new')}>
                  <Plus size={14} /> New Service
                </button>
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-th">Customer & Code</th>
                      <th className="table-th">Service Type</th>
                      <th className="table-th">Date</th>
                      <th className="table-th text-right">Amount</th>
                      <th className="table-th">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {stats.recent.map((s) => (
                      <tr
                        key={s.id}
                        className="table-row-link"
                        onClick={() => navigate(`/services/${s.id}`)}
                      >
                        <td className="table-td">
                          <span className="font-semibold text-ink-900 block">
                            {customerMap.get(s.customerId)?.name ?? 'Unknown Customer'}
                          </span>
                          <span className="code-chip mt-0.5">
                            {s.code}
                          </span>
                        </td>
                        <td className="table-td">
                          <span className="text-ink-800 font-medium">{s.serviceType}</span>
                          {s.product && (
                            <span className="block text-xs text-ink-400">
                              {[s.product, s.brand].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="table-td whitespace-nowrap text-ink-500 text-xs">
                          {formatDate(s.serviceDate)}
                        </td>
                        <td className="table-td text-right font-semibold text-ink-900">
                          {formatMoney(s.totalAmount, settings.currency)}
                          {s.balance > 0 && (
                            <span className="mt-0.5 block text-[11px] font-bold text-rose-600">
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
              <ul className="divide-y divide-line-soft sm:hidden">
                {stats.recent.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/services/${s.id}`)}
                      className="w-full px-4 py-3 text-left transition-colors active:bg-brand-50/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink-900">
                            {customerMap.get(s.customerId)?.name ?? 'Unknown Customer'}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] text-ink-600 font-medium">
                            {s.serviceType}
                          </p>
                          <p className="mt-1 text-[11.5px] text-ink-400">
                            {formatDate(s.serviceDate)} · {s.code}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-ink-900">
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

        {/* Right column: Action & Reminder Center */}
        <div className="space-y-4">
          {/* Urgent Reminders / Follow-ups */}
          <section className="panel">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-rose-50 text-rose-600">
                  <Bell size={14} />
                </span>
                <h2 className="panel-title">Upcoming Reminders</h2>
              </div>
              <Link to="/reminders" className="text-[12px] font-semibold text-brand-700 hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="p-3">
                <SkeletonRows rows={3} cols={2} />
              </div>
            ) : dueReminders.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-ink-500">
                All clear! No overdue or upcoming reminders for this week.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {dueReminders.map((r) => {
                  const c = customerMap.get(r.customerId)
                  return (
                    <li key={r.id} className="p-3 transition-colors hover:bg-brand-50/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink-900">{r.title}</p>
                          <p className="mt-0.5 truncate text-[11.5px] text-ink-600">
                            {c ? c.name : 'Unassigned'} {c?.phone ? `· ${c.phone}` : ''}
                          </p>
                        </div>
                        <span className="badge shrink-0 border-amber-200 bg-amber-50 text-amber-800">
                          {dueLabel(r.dueDate)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Upcoming Maintenance Preview */}
          <section className="panel">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-50 text-brand-600">
                  <CalendarClock size={14} />
                </span>
                <h2 className="panel-title">Scheduled Maintenance</h2>
              </div>
              <Link to="/reminders" className="text-[12px] font-semibold text-brand-700 hover:underline">
                All
              </Link>
            </div>
            {loading ? (
              <div className="p-3">
                <SkeletonRows rows={2} cols={2} />
              </div>
            ) : stats.upcoming.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-ink-500">
                No scheduled maintenance in next 30 days.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {stats.upcoming.slice(0, 4).map((s) => {
                  const c = customerMap.get(s.customerId)
                  const d = daysUntil(s.nextServiceDate) ?? 0
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/services/${s.id}`}
                        className="flex items-center justify-between gap-2 p-3 transition-colors hover:bg-brand-50/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink-900">
                            {c?.name ?? 'Unknown Customer'}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
                            {s.serviceType}
                          </p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="badge border-ink-200 bg-ink-100 text-ink-700">
                            {d === 0 ? 'Today' : `in ${d}d`}
                          </span>
                        </span>
                      </Link>
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

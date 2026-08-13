import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CreditCard, Download, Search, Wallet, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { PaymentModal } from '@/components/services/PaymentModal'
import { PaymentBadge } from '@/components/ui/Badges'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { Pagination, usePagination } from '@/components/ui/Pagination'
import { StatCard } from '@/components/StatCard'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, usePayments, useServices, useSettings } from '@/hooks/useData'
import { exportPaymentsCSV } from '@/services/backup'
import type { Service } from '@/types'
import { formatDate, formatMoney, monthKey, todayISO } from '@/utils/format'

type Tab = 'pending' | 'transactions'

export default function PaymentsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const services = useServices()
  const payments = usePayments()
  const customerMap = useCustomerMap()
  const settings = useSettings()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('filter') === 'pending' ? 'pending' : 'pending')
  const [query, setQuery] = useState('')
  const [payService, setPayService] = useState<Service | undefined>()

  const stats = useMemo(() => {
    const active = (services ?? []).filter((s) => s.status !== 'Cancelled')
    const thisMonth = monthKey(todayISO())
    return {
      outstanding: active.reduce((s, x) => s + Math.max(0, x.balance), 0),
      pendingCount: active.filter((x) => x.balance > 0).length,
      collectedThisMonth: (payments ?? [])
        .filter((p) => monthKey(p.date) === thisMonth)
        .reduce((s, p) => s + p.amount, 0),
      collectedTotal: (payments ?? []).reduce((s, p) => s + p.amount, 0),
    }
  }, [services, payments])

  const pendingRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return (services ?? [])
      .filter((s) => s.status !== 'Cancelled' && s.balance > 0)
      .filter((s) => {
        if (!q) return true
        const c = customerMap.get(s.customerId)
        if ((c?.name ?? '').toLowerCase().includes(q)) return true
        if (s.code.toLowerCase().includes(q)) return true
        if (digits.length >= 3 && (c?.phone ?? '').replace(/\D/g, '').includes(digits)) return true
        return false
      })
      .sort((a, b) => b.balance - a.balance)
  }, [services, query, customerMap])

  const transactionRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    const serviceMap = new Map((services ?? []).map((s) => [s.id, s]))
    return (payments ?? []).filter((p) => {
      if (!q) return true
      const c = customerMap.get(p.customerId)
      const s = serviceMap.get(p.serviceId)
      if ((c?.name ?? '').toLowerCase().includes(q)) return true
      if ((s?.code ?? '').toLowerCase().includes(q)) return true
      if (digits.length >= 3 && (c?.phone ?? '').replace(/\D/g, '').includes(digits)) return true
      return false
    })
  }, [payments, services, query, customerMap])

  const rows = tab === 'pending' ? pendingRows : transactionRows
  const pendingPage = usePagination(pendingRows, 20)
  const txPage = usePagination(transactionRows, 20)
  const { page, setPage, pageCount, total, pageSize } =
    tab === 'pending' ? pendingPage : txPage
  const serviceMap = useMemo(() => new Map((services ?? []).map((s) => [s.id, s])), [services])

  async function onExport() {
    try {
      const count = await exportPaymentsCSV()
      toast.success('Payments exported', `${count} transaction(s) saved as CSV.`)
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Could not export.')
    }
  }

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Track outstanding balances and every payment received."
        actions={
          <button className="btn-secondary" onClick={onExport} disabled={!payments?.length}>
            <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(stats.outstanding, settings.currency)}
          icon={CreditCard}
          tone={stats.outstanding > 0 ? 'danger' : 'success'}
          hint={`${stats.pendingCount} service(s)`}
        />
        <StatCard
          label="Collected this month"
          value={formatMoney(stats.collectedThisMonth, settings.currency)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Total collected"
          value={formatMoney(stats.collectedTotal, settings.currency)}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Transactions"
          value={payments?.length ?? 0}
          icon={CreditCard}
          tone="neutral"
        />
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex rounded-lg border border-ink-300 bg-white p-0.5">
          {(
            [
              ['pending', 'Pending payments'],
              ['transactions', 'All transactions'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === k ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9 pr-9"
            placeholder="Search customer, phone or service ID…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              pendingPage.setPage(1)
              txPage.setPage(1)
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
      </div>

      <div className="card overflow-hidden">
        {!services || !payments ? (
          <SkeletonRows rows={5} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={tab === 'pending' ? 'No pending payments' : 'No transactions yet'}
            message={
              tab === 'pending'
                ? 'Every service has been fully paid. Nice work!'
                : 'Payments recorded against services will appear here.'
            }
          />
        ) : tab === 'pending' ? (
          <>
            <ul className="divide-y divide-ink-100">
              {pendingPage.slice.map((s) => {
                const c = customerMap.get(s.customerId)
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => navigate(`/services/${s.id}`)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14.5px] font-semibold text-ink-900">
                          {c?.name ?? 'Unknown'}
                        </p>
                        <PaymentBadge status={s.paymentStatus} />
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-600">
                        {s.serviceType} · {s.code} · {formatDate(s.serviceDate)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">{c?.phone}</p>
                    </button>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <p className="text-[12px] text-ink-500">
                          Paid {formatMoney(s.amountPaid, settings.currency)} of{' '}
                          {formatMoney(s.totalAmount, settings.currency)}
                        </p>
                        <p className="text-[15px] font-bold text-red-600">
                          {formatMoney(s.balance, settings.currency)} due
                        </p>
                      </div>
                      <button className="btn-primary shrink-0" onClick={() => setPayService(s)}>
                        <CreditCard size={15} /> Collect
                      </button>
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
              label="pending payments"
            />
          </>
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Service</th>
                    <th className="table-th">Method</th>
                    <th className="table-th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {txPage.slice.map((payment) => {
                    const s = serviceMap.get(payment.serviceId)
                    return (
                      <tr
                        key={payment.id}
                        onClick={() => s && navigate(`/services/${s.id}`)}
                        className="cursor-pointer transition-colors hover:bg-ink-50"
                      >
                        <td className="table-td whitespace-nowrap">{formatDate(payment.date)}</td>
                        <td className="table-td">
                          {customerMap.get(payment.customerId)?.name ?? '—'}
                        </td>
                        <td className="table-td text-ink-600">
                          {s ? `${s.serviceType} · ${s.code}` : '—'}
                        </td>
                        <td className="table-td text-ink-600">{payment.method}</td>
                        <td className="table-td text-right font-semibold text-emerald-700">
                          {formatMoney(payment.amount, settings.currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 sm:hidden">
              {txPage.slice.map((payment) => {
                const s = serviceMap.get(payment.serviceId)
                return (
                  <li key={payment.id}>
                    <button
                      className="w-full px-4 py-3 text-left"
                      onClick={() => s && navigate(`/services/${s.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink-900">
                            {customerMap.get(payment.customerId)?.name ?? '—'}
                          </p>
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-600">
                            {s ? `${s.serviceType} · ${s.code}` : '—'}
                          </p>
                          <p className="mt-0.5 text-[12px] text-ink-500">
                            {formatDate(payment.date)} · {payment.method}
                          </p>
                        </div>
                        <p className="shrink-0 text-[15px] font-bold text-emerald-700">
                          {formatMoney(payment.amount, settings.currency)}
                        </p>
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
              label="transactions"
            />
          </>
        )}
      </div>

      <PaymentModal
        open={Boolean(payService)}
        onClose={() => setPayService(undefined)}
        service={payService}
        currency={settings.currency}
      />
    </>
  )
}

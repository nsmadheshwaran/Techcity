import { useMemo, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { ListToolbar, SearchInput } from '@/components/ui/ListToolbar'
import { ExpenseFormModal } from '@/components/expenses/ExpenseFormModal'
import { EmptyState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useExpenses } from '@/hooks/useData'
import { deleteExpense } from '@/services/expenses'
import type { Expense } from '@/types'
import { formatDate, formatMoney } from '@/utils/format'

const CATEGORIES = [
  'Fuel / Travel',
  'Food',
  'Parts Purchase',
  'Tools',
  'Rent',
  'Electricity',
  'Phone / Internet',
  'Marketing',
  'Other',
]

export default function ExpensesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const expenses = useExpenses()
  const customerMap = useCustomerMap()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | undefined>()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [category, setCategory] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (expenses ?? []).filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (category !== 'all' && e.category !== category) return false
      if (!q) return true
      const linked = e.customerId ? (customerMap.get(e.customerId)?.name ?? '') : ''
      return (
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      )
    })
  }, [expenses, query, typeFilter, category, customerMap])

  const totals = useMemo(() => {
    let spent = 0
    let earned = 0
    for (const e of expenses ?? []) {
      if (e.type === 'income') earned += e.amount
      else spent += e.amount
    }
    return { spent, earned, net: earned - spent }
  }, [expenses])

  async function onDelete(e: Expense) {
    const ok = await confirm({
      title: 'Delete this entry?',
      message: `${e.title} (${formatMoney(e.amount)}) will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteExpense(e.id)
      toast.success('Entry deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  return (
    <>
      <PageHeader
        back="/"
        title="Expenses"
        subtitle="Every rupee out and every extra rupee in — fuel, food, parts, side earnings"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(undefined)
              setModalOpen(true)
            }}
          >
            <Plus size={16} /> Add Entry
          </button>
        }
      />

      {/* Totals — same KPI tile the rest of the app uses */}
      <div className="mb-3.5 grid grid-cols-3 gap-2.5">
        <StatCard
          label="Total Spending"
          value={formatMoney(totals.spent)}
          icon={TrendingDown}
          tone="danger"
        />
        <StatCard
          label="Extra Earning"
          value={formatMoney(totals.earned)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Net"
          value={formatMoney(totals.net)}
          icon={Wallet}
          tone={totals.net >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="panel">
        <ListToolbar>
          <SearchInput
            className="min-w-0 flex-1 basis-52"
            value={query}
            onChange={setQuery}
            placeholder="Search title, category, notes…"
            ariaLabel="Search expenses"
          />
          <div className="flex overflow-hidden rounded-md border border-ink-300">
            {(
              [
                ['all', 'All'],
                ['expense', 'Money Out'],
                ['income', 'Money In'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value)}
                className={`px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  typeFilter === value
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-ink-600 hover:bg-ink-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="input w-auto py-1.5 text-[12.5px] font-medium"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(query || typeFilter !== 'all' || category !== 'all') && (
            <button
              className="btn-ghost"
              onClick={() => {
                setQuery('')
                setTypeFilter('all')
                setCategory('all')
              }}
            >
              <X size={13} /> Clear
            </button>
          )}
        </ListToolbar>

        {!expenses?.length ? (
          <EmptyState
            icon={Wallet}
            title="No expenses tracked yet"
            message="Record fuel, food, part purchases and other shop spending here — plus extra earnings like scrap sales."
            action={
              <button className="btn-primary" onClick={() => setModalOpen(true)}>
                <Plus size={14} /> Add your first entry
              </button>
            }
          />
        ) : !filtered.length ? (
          <EmptyState icon={Search} title="Nothing matches" message="Try different filters." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {filtered.map((e) => {
              const income = e.type === 'income'
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      income ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {income ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-medium text-ink-900">
                      {e.title}
                      <span className="badge border-ink-200 bg-ink-100 text-[10.5px] text-ink-600">
                        {e.category}
                      </span>
                      {e.customerId && customerMap.get(e.customerId) && (
                        <Link
                          to={`/customers/${e.customerId}`}
                          className="text-[12px] font-normal text-brand-700 hover:underline"
                        >
                          {customerMap.get(e.customerId)!.name}
                        </Link>
                      )}
                    </p>
                    <p className="text-[12px] text-ink-500">
                      {formatDate(e.date)}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[14px] font-bold ${
                      income ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {income ? '+' : '−'} {formatMoney(e.amount)}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      className="btn-ghost px-2 py-1.5"
                      aria-label="Edit entry"
                      onClick={() => {
                        setEditing(e)
                        setModalOpen(true)
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-ghost px-2 py-1.5 text-red-600 hover:bg-red-50"
                      aria-label="Delete entry"
                      onClick={() => onDelete(e)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(undefined)
        }}
        expense={editing}
      />
    </>
  )
}

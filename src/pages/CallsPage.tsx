import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Pencil,
  Phone,
  Plus,
  Route as RouteMap,
  Rows3,
  Search,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CallFormModal } from '@/components/calls/CallFormModal'
import { EmptyState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCalls, useCustomerMap } from '@/hooks/useData'
import { deleteCall, updateCall } from '@/services/calls'
import {
  CALL_SOURCES,
  CALL_STATUSES,
  type Call,
  type CallPriority,
  type CallSource,
  type CallStatus,
} from '@/types'
import { formatDate, initials } from '@/utils/format'

const SOURCE_STYLES: Record<CallSource, string> = {
  Online: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Direct: 'border-brand-100 bg-brand-50 text-brand-700',
  Demo: 'border-sky-200 bg-sky-50 text-sky-700',
}

const STATUS_STYLES: Record<CallStatus, string> = {
  Pending: 'border-red-200 bg-red-50 text-red-700',
  'In Progress': 'border-amber-200 bg-amber-50 text-amber-700',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'No Response': 'border-ink-200 bg-ink-100 text-ink-600',
}

const PRIORITY_STYLES: Record<CallPriority, string> = {
  P1: 'border-red-200 bg-red-50 text-red-700',
  P2: 'border-amber-200 bg-amber-50 text-amber-700',
  P3: 'border-sky-200 bg-sky-50 text-sky-700',
}

const STATUS_ACTIVE: Record<CallStatus, string> = {
  Pending: 'border-red-600 bg-red-600 text-white',
  'In Progress': 'border-amber-500 bg-amber-500 text-white',
  Completed: 'border-emerald-600 bg-emerald-600 text-white',
  'No Response': 'border-ink-700 bg-ink-700 text-white',
}

/** Start a service straight from a booked call — the call is closed out when the service is saved. */
const serviceHref = (c: Call) => `/services/new?callId=${c.id}${c.customerId ? `&customerId=${c.customerId}` : ''}`

/** One customer (or new lead) with all their calls, for the Call View. */
interface CallGroup {
  key: string
  title: string
  phone?: string
  customerId?: string
  calls: Call[]
}

export default function CallsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const calls = useCalls()
  const customerMap = useCustomerMap()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Call | undefined>()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | CallSource>('all')
  const [status, setStatus] = useState<'all' | CallStatus>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  /** 'list' = every call one by one; 'call' = grouped per customer/lead. */
  const [view, setView] = useState<'list' | 'call'>('list')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const counts = useMemo(() => {
    const c = { total: 0 } as Record<string, number>
    c.total = calls?.length ?? 0
    for (const s of CALL_STATUSES) c[s] = 0
    for (const call of calls ?? []) c[call.status] = (c[call.status] ?? 0) + 1
    return c
  }, [calls])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (calls ?? []).filter((c) => {
      if (source !== 'all' && c.source !== source) return false
      if (status !== 'all' && c.status !== status) return false
      if (from && c.date < from) return false
      if (to && c.date > to) return false
      if (!q) return true
      const linked = c.customerId ? customerMap.get(c.customerId)?.name ?? '' : ''
      return (
        c.name.toLowerCase().includes(q) ||
        (c.contactPerson ?? '').toLowerCase().includes(q) ||
        (c.issue ?? '').toLowerCase().includes(q) ||
        (c.notes ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      )
    })
  }, [calls, query, source, status, from, to, customerMap])

  /**
   * Call View — the same filtered calls grouped by customer (or by caller name
   * when the call is a new lead without a saved customer), newest call first.
   */
  const groups = useMemo(() => {
    const map = new Map<string, CallGroup>()
    for (const c of filtered) {
      const key = c.customerId ?? `lead:${c.name.trim().toLowerCase()}`
      const title = c.customerId ? (customerMap.get(c.customerId)?.name ?? c.name) : c.name
      const phone = c.customerId ? customerMap.get(c.customerId)?.phone : c.phone
      const group = map.get(key)
      if (group) {
        group.calls.push(c)
        if (!group.phone && phone) group.phone = phone
        if (!group.customerId && c.customerId) group.customerId = c.customerId
      } else {
        map.set(key, { key, title, phone, customerId: c.customerId, calls: [c] })
      }
    }
    const list = [...map.values()]
    for (const g of list) {
      g.calls.sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      )
    }
    list.sort((a, b) => b.calls[0].date.localeCompare(a.calls[0].date))
    return list
  }, [filtered, customerMap])

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  async function changeStatus(call: Call, next: CallStatus) {
    try {
      await updateCall(call.id, { status: next })
      toast.success('Status updated', `${call.name} is now ${next}.`)
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not update status.')
    }
  }

  async function onDelete(call: Call) {
    const ok = await confirm({
      title: 'Delete this call?',
      message: `The call from ${call.name} (${formatDate(call.date)}) will be permanently removed along with its follow-up reminder.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCall(call.id)
      toast.success('Call deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete the call.')
    }
  }

  const quickStatus = (value: 'all' | CallStatus) =>
    setStatus(status === value ? 'all' : value)

  const statusChip = (value: 'all' | CallStatus) => {
    const base = 'rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors'
    if (value === 'all')
      return `${base} ${
        status === 'all'
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
      }`
    return `${base} ${status === value ? STATUS_ACTIVE[value] : STATUS_STYLES[value]}`
  }

  return (
    <>
      <PageHeader
        back="/"
        title="Call Book"
        subtitle="Every enquiry in one place — book calls, set priority and follow up"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(undefined)
              setModalOpen(true)
            }}
          >
            <Plus size={16} /> Book a Call
          </button>
        }
      />

      {/* Quick status tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button className={statusChip('all')} onClick={() => quickStatus('all')}>
          All ({counts.total})
        </button>
        {CALL_STATUSES.map((s) => (
          <button key={s} className={statusChip(s)} onClick={() => quickStatus(s)}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card mb-4 space-y-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-52">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search name, phone, issue…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={source}
            onChange={(e) => setSource(e.target.value as 'all' | CallSource)}
            aria-label="Filter by call type"
          >
            <option value="all">All types</option>
            {CALL_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-ink-300" role="group" aria-label="Switch view">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium transition-colors ${
                view === 'list' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'
              }`}
              onClick={() => setView('list')}
            >
              <Rows3 size={14} /> All Calls
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 border-l border-ink-300 px-3 py-2 text-[12.5px] font-medium transition-colors ${
                view === 'call' ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'
              }`}
              onClick={() => setView('call')}
            >
              <Users size={14} /> Call View
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-auto"
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-[12.5px] text-ink-400">to</span>
          <input
            className="input w-auto"
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {(query || source !== 'all' || status !== 'all' || from || to) && (
            <button
              className="btn-ghost px-2 py-1.5 text-[12.5px]"
              onClick={() => {
                setQuery('')
                setSource('all')
                setStatus('all')
                setFrom('')
                setTo('')
              }}
            >
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {!calls?.length ? (
        <div className="card">
          <EmptyState
            icon={Phone}
            title="No calls booked yet"
            message="Book the first enquiry — online, direct walk-in or demo — so no lead is forgotten."
            action={
              <button className="btn-primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Book your first call
              </button>
            }
          />
        </div>
      ) : !filtered.length ? (
        <div className="card">
          <EmptyState icon={Search} title="No calls match" message="Try different filters." />
        </div>
      ) : view === 'call' ? (
        <CallView
          groups={groups}
          openKeys={openGroups}
          onToggle={toggleGroup}
          onStatusChange={changeStatus}
          onEdit={(c) => {
            setEditing(c)
            setModalOpen(true)
          }}
          onDelete={onDelete}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-ink-900 text-white">
                <tr>
                  <th className="table-th text-white">S.No</th>
                  <th className="table-th text-white">Booked</th>
                  <th className="table-th text-white">Customer</th>
                  <th className="table-th text-white">Mobile</th>
                  <th className="table-th text-white">Priority</th>
                  <th className="table-th text-white">Issue</th>
                  <th className="table-th text-white">Status</th>
                  <th className="table-th text-right text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c, idx) => {
                  const linked = c.customerId ? customerMap.get(c.customerId) : undefined
                  return (
                    <tr key={c.id} className="align-middle">
                      <td className="table-td text-ink-400">{idx + 1}</td>
                      <td className="table-td whitespace-nowrap text-[12.5px]">
                        {formatDate(c.date)}
                        {c.appointmentDate && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-medium text-brand-700">
                            <CalendarClock size={11} /> Visit {formatDate(c.appointmentDate)}
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        <p className="font-medium text-ink-900">{c.name}</p>
                        <p className="text-[12px] text-ink-500">
                          {c.contactPerson ? `${c.contactPerson} · ` : ''}
                          <span className={`badge !px-1.5 !py-0 text-[10.5px] ${SOURCE_STYLES[c.source]}`}>
                            {c.source}
                          </span>
                          {linked && (
                            <Link to={`/customers/${linked.id}`} className="text-brand-700 hover:underline">
                              {' '}· {linked.name}
                            </Link>
                          )}
                        </p>
                      </td>
                      <td className="table-td whitespace-nowrap">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="text-brand-700 hover:underline">
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="table-td">
                        {c.priority ? (
                          <span className={`badge ${PRIORITY_STYLES[c.priority]}`}>{c.priority}</span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                        {c.distanceKm ? (
                          <span className="mt-0.5 flex items-center gap-0.5 text-[11px] text-ink-500">
                            <RouteMap size={10} /> {c.distanceKm} km
                          </span>
                        ) : null}
                      </td>
                      <td className="table-td max-w-[220px]">
                        <p className="truncate text-[13px] text-ink-700" title={c.issue}>
                          {c.issue || '—'}
                        </p>
                        {c.notes && (
                          <p className="truncate text-[11.5px] text-ink-400" title={c.notes}>
                            {c.notes}
                          </p>
                        )}
                      </td>
                      <td className="table-td">
                        <select
                          className="input w-auto py-1 text-[12.5px]"
                          value={c.status}
                          aria-label="Update status"
                          onChange={(e) => changeStatus(c, e.target.value as CallStatus)}
                        >
                          {CALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="table-td">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={serviceHref(c)}
                            className="btn-ghost px-2 py-1.5"
                            title="Book a service from this call"
                            aria-label="Book a service from this call"
                          >
                            <Wrench size={15} />
                          </Link>
                          {linked && (
                            <Link
                              to={`/customers/${linked.id}`}
                              className="btn-ghost px-2 py-1.5"
                              title="Open customer history"
                              aria-label="Open customer history"
                            >
                              <Users size={15} />
                            </Link>
                          )}
                          <button
                            className="btn-ghost px-2 py-1.5"
                            aria-label="Edit call"
                            onClick={() => {
                              setEditing(c)
                              setModalOpen(true)
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn-ghost px-2 py-1.5 text-red-600 hover:bg-red-50"
                            aria-label="Delete call"
                            onClick={() => onDelete(c)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2.5 md:hidden">
            {filtered.map((c) => {
              const linked = c.customerId ? customerMap.get(c.customerId) : undefined
              return (
                <li key={c.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[15px] font-semibold text-ink-900">{c.name}</p>
                        {c.priority && (
                          <span className={`badge ${PRIORITY_STYLES[c.priority]}`}>{c.priority}</span>
                        )}
                        <span className={`badge ${SOURCE_STYLES[c.source]}`}>{c.source}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-500">
                        <span>{formatDate(c.date)}</span>
                        {c.contactPerson && <span>{c.contactPerson}</span>}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-brand-700 hover:underline">
                            {c.phone}
                          </a>
                        )}
                        {linked ? (
                          <Link to={`/customers/${linked.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                            <Users size={13} /> {linked.name}
                          </Link>
                        ) : (
                          <span className="text-ink-400">New lead</span>
                        )}
                      </p>
                      {c.issue && (
                        <p className="mt-1.5 rounded-lg bg-ink-50 px-2.5 py-1.5 text-[12.5px] text-ink-700">
                          {c.issue}
                        </p>
                      )}
                      {c.appointmentDate && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700">
                          <CalendarClock size={12} /> Visit on {formatDate(c.appointmentDate)}
                        </p>
                      )}
                      {c.notes && (
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{c.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`badge ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                      <select
                        className="input w-auto py-1 text-[12px]"
                        value={c.status}
                        aria-label="Update status"
                        onChange={(e) => changeStatus(c, e.target.value as CallStatus)}
                      >
                        {CALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <div className="mt-1 flex gap-1">
                        <Link
                          to={serviceHref(c)}
                          className="btn-ghost px-2 py-1.5"
                          aria-label="Book a service from this call"
                        >
                          <Wrench size={15} />
                        </Link>
                        <button
                          className="btn-ghost px-2 py-1.5"
                          onClick={() => {
                            setEditing(c)
                            setModalOpen(true)
                          }}
                          aria-label="Edit call"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-ghost px-2 py-1.5 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(c)}
                          aria-label="Delete call"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <CallFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(undefined)
        }}
        call={editing}
      />
    </>
  )
}

/**
 * Call View — calls grouped per customer so the owner can see every
 * conversation with one customer in a single place and turn a booked call
 * into a service with one tap.
 */
function CallView({
  groups,
  openKeys,
  onToggle,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  groups: CallGroup[]
  openKeys: Set<string>
  onToggle: (key: string) => void
  onStatusChange: (call: Call, next: CallStatus) => void
  onEdit: (call: Call) => void
  onDelete: (call: Call) => void
}) {
  return (
    <div className="space-y-2.5">
      {groups.map((g) => {
        const open = openKeys.has(g.key)
        const openCount = g.calls.filter((c) => c.status !== 'Completed' && c.status !== 'No Response').length
        return (
          <section key={g.key} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => onToggle(g.key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50"
              aria-expanded={open}
            >
              {open ? (
                <ChevronDown size={16} className="shrink-0 text-ink-400" />
              ) : (
                <ChevronRight size={16} className="shrink-0 text-ink-400" />
              )}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
                {initials(g.title)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-[14px] font-semibold text-ink-900">{g.title}</span>
                  {openCount > 0 && (
                    <span className="badge border-red-200 bg-red-50 text-red-700">
                      {openCount} open
                    </span>
                  )}
                  <span className="badge border-ink-200 bg-ink-100 text-ink-600">
                    {g.calls.length} call{g.calls.length === 1 ? '' : 's'}
                  </span>
                </span>
                {g.phone && <span className="mt-0.5 block text-[12px] text-ink-500">{g.phone}</span>}
              </span>
              {g.customerId && (
                <Link
                  to={`/customers/${g.customerId}`}
                  className="btn-ghost shrink-0 px-2 py-1.5 text-[12.5px]"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open customer profile"
                >
                  <Users size={15} />
                </Link>
              )}
            </button>

            {open && (
              <ul className="divide-y divide-ink-100 border-t border-ink-100">
                {g.calls.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`badge ${SOURCE_STYLES[c.source]}`}>{c.source}</span>
                      <span className={`badge ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                      {c.priority && (
                        <span className={`badge ${PRIORITY_STYLES[c.priority]}`}>{c.priority}</span>
                      )}
                      {c.distanceKm ? (
                        <span className="badge border-ink-200 bg-ink-100 text-ink-600">
                          <RouteMap size={11} className="mr-0.5 inline" /> {c.distanceKm} km
                        </span>
                      ) : null}
                      <span className="text-[12.5px] text-ink-500">{formatDate(c.date)}</span>
                      {c.appointmentDate && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700">
                          <CalendarClock size={12} /> Visit {formatDate(c.appointmentDate)}
                        </span>
                      )}
                    </div>
                    {c.issue && (
                      <p className="mt-1.5 rounded-lg bg-ink-50 px-2.5 py-1.5 text-[12.5px] text-ink-700">
                        {c.issue}
                      </p>
                    )}
                    {c.notes && (
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{c.notes}</p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Link to={serviceHref(c)} className="btn-primary py-1.5 text-[12.5px]">
                        <Wrench size={13} /> Book Service
                      </Link>
                      <select
                        className="input w-auto py-1 text-[12.5px]"
                        value={c.status}
                        aria-label="Update status"
                        onChange={(e) => onStatusChange(c, e.target.value as CallStatus)}
                      >
                        {CALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1.5"
                        aria-label="Edit call"
                        onClick={() => onEdit(c)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Delete call"
                        onClick={() => onDelete(c)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
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
import { formatDate } from '@/utils/format'

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

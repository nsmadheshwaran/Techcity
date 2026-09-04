import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Phone, PhoneCall, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CallFormModal } from '@/components/calls/CallFormModal'
import { EmptyState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCalls, useCustomerMap } from '@/hooks/useData'
import { deleteCall } from '@/services/calls'
import { CALL_SOURCES, type Call, type CallSource } from '@/types'
import { formatDate } from '@/utils/format'

const SOURCE_STYLES: Record<CallSource, string> = {
  Online: 'border-brand-100 bg-brand-50 text-brand-700',
  Direct: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Demo: 'border-amber-200 bg-amber-50 text-amber-700',
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (calls ?? []).filter((c) => {
      if (source !== 'all' && c.source !== source) return false
      if (!q) return true
      const customerName = c.customerId ? customerMap.get(c.customerId)?.name ?? '' : ''
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.notes ?? '').toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q)
      )
    })
  }, [calls, query, source, customerMap])

  async function onDelete(call: Call) {
    const ok = await confirm({
      title: 'Delete this call?',
      message: `The call from ${call.name} (${formatDate(call.date)}) will be permanently removed.`,
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

  const counts = useMemo(() => {
    const total = calls?.length ?? 0
    const bySource = new Map<CallSource, number>()
    for (const c of calls ?? []) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1)
    return { total, bySource }
  }, [calls])

  return (
    <>
      <PageHeader
        back="/"
        title="Call Log"
        subtitle="Every enquiry in one place — online, direct or demo"
        actions={
          <>
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(undefined)
                setModalOpen(true)
              }}
            >
              <Plus size={16} /> Log a Call
            </button>
          </>
        }
      />

      {/* Source summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <PhoneCall size={17} />
          </span>
          <div>
            <p className="text-[12px] text-ink-500">Total calls</p>
            <p className="text-lg font-bold text-ink-900">{counts.total}</p>
          </div>
        </div>
        {CALL_SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => setSource(source === s ? 'all' : s)}
            className={`card flex items-center gap-3 p-4 text-left transition-colors ${
              source === s ? 'ring-2 ring-brand-500/60' : 'hover:bg-ink-50'
            }`}
          >
            <span className={`badge ${SOURCE_STYLES[s]}`}>{s}</span>
            <div>
              <p className="text-[12px] text-ink-500">{s} calls</p>
              <p className="text-lg font-bold text-ink-900">{counts.bySource.get(s) ?? 0}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs flex-1"
          placeholder="Search by name, phone, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input w-auto"
          value={source}
          onChange={(e) => setSource(e.target.value as 'all' | CallSource)}
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          {CALL_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!filtered.length ? (
        <div className="card">
          <EmptyState
            icon={Phone}
            title={query || source !== 'all' ? 'No calls match' : 'No calls logged yet'}
            message={
              query || source !== 'all'
                ? 'Try a different search or clear the filters.'
                : 'Start logging enquiries — online, direct walk-ins or demos — so no lead is forgotten.'
            }
            action={
              !query && source === 'all' ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setEditing(undefined)
                    setModalOpen(true)
                  }}
                >
                  <Plus size={16} /> Log your first call
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((c) => {
            const linked = c.customerId ? customerMap.get(c.customerId) : undefined
            return (
              <li key={c.id} className="card flex items-start gap-3 p-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <Phone size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[15px] font-semibold text-ink-900">{c.name}</p>
                    <span className={`badge ${SOURCE_STYLES[c.source]}`}>{c.source}</span>
                    <span className="badge border-ink-200 bg-ink-100 text-ink-600">{c.status}</span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-500">
                    <span>{formatDate(c.date)}</span>
                    {c.phone && <a href={`tel:${c.phone}`} className="text-brand-700 hover:underline">{c.phone}</a>}
                    {linked ? (
                      <Link to={`/customers/${linked.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Users size={13} /> {linked.name}
                      </Link>
                    ) : (
                      <span className="text-ink-400">New lead</span>
                    )}
                  </p>
                  {c.notes && (
                    <p className="mt-1.5 rounded-lg bg-ink-50 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink-600">
                      {c.notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
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
              </li>
            )
          })}
        </ul>
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

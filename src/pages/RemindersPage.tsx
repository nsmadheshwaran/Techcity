import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bell, Check, MessageCircle, Phone, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { EmptyState, SkeletonRows } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useCustomerMap, useCustomers, useReminders, useSettings } from '@/hooks/useData'
import { createReminder, deleteReminder, groupReminders, toggleReminder } from '@/services/reminders'
import type { Reminder, ReminderType } from '@/types'
import { dueLabel, formatDateLong, todayISO, toWhatsAppNumber } from '@/utils/format'

const BUCKETS: { key: 'overdue' | 'today' | 'week' | 'month' | 'later'; label: string; tone: string }[] =
  [
    { key: 'overdue', label: 'Overdue', tone: 'text-red-700 bg-red-50 border-red-200' },
    { key: 'today', label: 'Due Today', tone: 'text-amber-800 bg-amber-50 border-amber-200' },
    { key: 'week', label: 'Due This Week', tone: 'text-brand-700 bg-brand-50 border-brand-200' },
    { key: 'month', label: 'Due This Month', tone: 'text-ink-700 bg-ink-100 border-ink-200' },
    { key: 'later', label: 'Later', tone: 'text-ink-600 bg-ink-50 border-ink-200' },
  ]

export default function RemindersPage() {
  const reminders = useReminders()
  const customers = useCustomers()
  const customerMap = useCustomerMap()
  const settings = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const [showDone, setShowDone] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>(
    searchParams.get('type') === 'warranty' ? 'Warranty' : '',
  )
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(
    () =>
      (reminders ?? []).filter(
        (r) => (showDone ? true : !r.done) && (typeFilter ? r.type === typeFilter : true),
      ),
    [reminders, showDone, typeFilter],
  )

  const groups = useMemo(() => groupReminders(filtered), [filtered])

  async function onToggle(r: Reminder) {
    try {
      await toggleReminder(r.id, !r.done)
      toast.success(r.done ? 'Reminder reopened' : 'Reminder marked done')
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not update.')
    }
  }

  async function onDelete(r: Reminder) {
    const ok = await confirm({
      title: 'Delete this reminder?',
      message: r.title,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteReminder(r.id)
      toast.success('Reminder deleted')
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const pendingCount = (reminders ?? []).filter((r) => !r.done).length

  return (
    <>
      <PageHeader
        title="Reminders"
        subtitle={`${pendingCount} open reminder${pendingCount === 1 ? '' : 's'} — next services, warranties and follow-ups.`}
        actions={
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Add Reminder
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <select
          className="input w-auto py-2 text-[13px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="Next Service">Next Service</option>
          <option value="Warranty">Warranty</option>
          <option value="Payment">Payment</option>
          <option value="Custom">Custom</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 accent-brand-600"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Show completed
        </label>
      </div>

      {!reminders ? (
        <div className="card">
          <SkeletonRows rows={5} cols={3} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Bell}
            title="No reminders"
            message="Reminders are created automatically when you set a next service date or warranty period on a service."
            action={
              <button className="btn-primary" onClick={() => setAddOpen(true)}>
                <Plus size={16} /> Add Reminder
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {BUCKETS.map(({ key, label, tone }) => {
            const items = groups[key]
            if (!items.length) return null
            return (
              <section key={key} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2.5">
                  <h2 className="text-[14px] font-semibold text-ink-900">{label}</h2>
                  <span className={`badge ${tone}`}>{items.length}</span>
                </div>
                <ul className="divide-y divide-ink-100">
                  {items.map((r) => {
                    const c = customerMap.get(r.customerId)
                    return (
                      <li key={r.id} className="flex items-start gap-3 p-4">
                        <button
                          onClick={() => onToggle(r)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            r.done
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-ink-300 hover:border-brand-500'
                          }`}
                          aria-label={r.done ? 'Reopen reminder' : 'Mark as done'}
                        >
                          {r.done && <Check size={13} />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`text-[14px] font-semibold ${
                                r.done ? 'text-ink-400 line-through' : 'text-ink-900'
                              }`}
                            >
                              {c?.name ?? 'Unknown customer'}
                            </p>
                            <span className="badge border-ink-200 bg-ink-100 text-ink-600">
                              {r.type}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-ink-600">{r.title}</p>
                          <p className="mt-0.5 text-[12.5px] text-ink-500">
                            {dueLabel(r.dueDate)} · {formatDateLong(r.dueDate)}
                          </p>
                          {c?.phone && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-ink-500">
                              <Phone size={11} /> {c.phone}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {c?.phone && (
                            <a
                              href={`https://wa.me/${toWhatsAppNumber(c.phone)}?text=${encodeURIComponent(
                                `Hello ${c.name.split(' ')[0]},\n\nThis is a reminder from ${settings.name}.\n${r.title}\nDue: ${formatDateLong(r.dueDate)}\n\nPlease contact us to schedule.\n\nThank you.\n${settings.name}\n${settings.phone}`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost px-2 text-emerald-700 hover:bg-emerald-50"
                              aria-label="Send WhatsApp reminder"
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                          {r.serviceId && (
                            <Link
                              to={`/services/${r.serviceId}`}
                              className="btn-ghost px-2 py-1 text-[12.5px]"
                            >
                              View
                            </Link>
                          )}
                          <button
                            onClick={() => onToggle(r)}
                            className="btn-ghost px-2"
                            aria-label={r.done ? 'Reopen' : 'Complete'}
                          >
                            {r.done ? <RotateCcw size={15} /> : <Check size={15} />}
                          </button>
                          <button
                            onClick={() => onDelete(r)}
                            className="btn-ghost px-2 text-red-600 hover:bg-red-50"
                            aria-label="Delete reminder"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <AddReminderModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        customers={customers ?? []}
      />
    </>
  )
}

function AddReminderModal({
  open,
  onClose,
  customers,
}: {
  open: boolean
  onClose: () => void
  customers: { id: string; name: string; phone: string }[]
}) {
  const toast = useToast()
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ReminderType>('Custom')
  const [dueDate, setDueDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!customerId) return setError('Please select a customer.')
    if (!title.trim()) return setError('Enter what this reminder is about.')
    setSaving(true)
    setError('')
    try {
      await createReminder({
        customerId,
        type,
        title: title.trim(),
        dueDate,
        notes: notes.trim() || undefined,
      })
      toast.success('Reminder added')
      setTitle('')
      setNotes('')
      setCustomerId('')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save reminder.'
      setError(message)
      toast.error('Save failed', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Reminder"
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Add Reminder'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <SelectField
          label="Customer"
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.phone}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Reminder"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Follow up on AMC renewal"
        />
        <SelectField
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as ReminderType)}
          options={['Next Service', 'Warranty', 'Payment', 'Custom']}
        />
        <TextField
          label="Due Date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </Modal>
  )
}

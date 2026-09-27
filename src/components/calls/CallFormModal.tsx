import { useEffect, useMemo, useState } from 'react'
import { Globe, Phone, Save, Video } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ComboField, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useCustomers } from '@/hooks/useData'
import { createCall, updateCall } from '@/services/calls'
import {
  CALL_PRIORITIES,
  CALL_SOURCES,
  CALL_STATUSES,
  type Call,
  type CallPriority,
  type CallSource,
  type CallStatus,
} from '@/types'
import { todayISO } from '@/utils/format'

const SOURCE_META: Record<CallSource, { icon: typeof Globe; active: string }> = {
  Online: { icon: Globe, active: 'bg-emerald-600 border-emerald-600 text-white' },
  Direct: { icon: Phone, active: 'bg-brand-600 border-brand-600 text-white' },
  Demo: { icon: Video, active: 'bg-sky-600 border-sky-600 text-white' },
}

const ISSUE_SUGGESTIONS = [
  'No Display',
  'System Dead / Not Booting',
  'Slow Performance',
  'OS / Software Problem',
  'CCTV Not Recording',
  'Camera Not Working',
  'DVR / NVR Problem',
  'Network / Internet Issue',
  'Printer Not Working',
  'Laptop Repair',
  'Data Recovery',
  'AMC Visit',
  'New Installation / Quotation',
  'Sales Enquiry',
  'Other',
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (call: Call) => void
  call?: Call
  /** Pre-select a linked customer (used when creating from a customer). */
  defaultCustomerId?: string
}

export function CallFormModal({ open, onClose, onSaved, call, defaultCustomerId }: Props) {
  const toast = useToast()
  const customers = useCustomers()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: todayISO(),
    source: 'Direct' as CallSource,
    status: 'Pending' as CallStatus,
    customerId: '',
    name: '',
    contactPerson: '',
    phone: '',
    issue: '',
    priority: '' as '' | CallPriority,
    appointmentDate: '',
    distanceKm: '',
    notes: '',
  })
  const [prefillCustomer, setPrefillCustomer] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (call) {
      setForm({
        date: call.date,
        source: call.source,
        status: call.status,
        customerId: call.customerId ?? '',
        name: call.name,
        contactPerson: call.contactPerson ?? '',
        phone: call.phone ?? '',
        issue: call.issue ?? '',
        priority: call.priority ?? '',
        appointmentDate: call.appointmentDate ?? '',
        distanceKm: call.distanceKm ? String(call.distanceKm) : '',
        notes: call.notes ?? '',
      })
    } else {
      setForm({
        date: todayISO(),
        source: 'Direct',
        status: 'Pending',
        customerId: defaultCustomerId ?? '',
        name: '',
        contactPerson: '',
        phone: '',
        issue: '',
        priority: '',
        appointmentDate: '',
        distanceKm: '',
        notes: '',
      })
    }
    setPrefillCustomer('')
  }, [open, call, defaultCustomerId])

  const linkedCustomer = useMemo(
    () => (form.customerId ? (customers ?? []).find((c) => c.id === form.customerId) : undefined),
    [customers, form.customerId],
  )

  // When an existing customer is picked, offer their name/number unless typed.
  useEffect(() => {
    if (!linkedCustomer || call || prefillCustomer === form.customerId) return
    setPrefillCustomer(form.customerId)
    setForm((f) => ({
      ...f,
      name: f.name.trim() ? f.name : linkedCustomer.name,
      phone: f.phone.trim() ? f.phone : linkedCustomer.phone,
      // Default the distance from the customer's saved location.
      distanceKm: f.distanceKm || (linkedCustomer.distanceKm ? String(linkedCustomer.distanceKm) : ''),
    }))
  }, [linkedCustomer, form.customerId, prefillCustomer, call])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    const name = form.name.trim()
    if (!name) {
      setError('Customer name is required.')
      return
    }
    if (!form.phone.trim() && !linkedCustomer) {
      setError('Contact number is required for a new lead.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        date: form.date,
        source: form.source,
        status: form.status,
        customerId: form.customerId || undefined,
        name,
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        issue: form.issue.trim(),
        priority: form.priority || undefined,
        appointmentDate: form.appointmentDate || undefined,
        distanceKm: form.distanceKm,
        notes: form.notes.trim(),
      }
      const saved = call ? await updateCall(call.id, payload) : await createCall(payload)
      toast.success(call ? 'Call updated' : 'Call booked', `${saved.name} · ${saved.source}`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the call.'
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
      title={call ? 'Edit Call' : 'Book a Call'}
      description="Log every enquiry — online, direct walk-in or demo — and set the visit date for follow-up."
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : call ? 'Save Changes' : 'Book Call'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Call type — Online / Direct / Demo */}
      <div className="mb-4">
        <p className="field-label mb-1.5">Call Type</p>
        <div className="grid grid-cols-3 gap-2">
          {CALL_SOURCES.map((s) => {
            const meta = SOURCE_META[s]
            const Icon = meta.icon
            const active = form.source === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => set('source', s)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? meta.active
                    : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
                }`}
              >
                <Icon size={15} /> {s}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Booked Date"
          type="date"
          required
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(e) => set('status', e.target.value as CallStatus)}
          options={[...CALL_STATUSES]}
        />

        {/* Customer / ledger */}
        <div className="sm:col-span-2">
          <SelectField
            label="Ledger / Existing Customer"
            value={form.customerId}
            onChange={(e) => set('customerId', e.target.value)}
            hint={
              linkedCustomer
                ? 'Linked customer — their profile is available from the list.'
                : 'Optional — leave empty to add a new lead below.'
            }
          >
            <option value="">New lead (type customer name below)</option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.phone}
              </option>
            ))}
          </SelectField>
        </div>

        <TextField
          label="Customer Name"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Company / customer name"
          autoFocus={!call}
        />
        <TextField
          label="Contact Number"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="Mobile / landline"
        />
        <TextField
          label="Contact Person"
          value={form.contactPerson}
          onChange={(e) => set('contactPerson', e.target.value)}
          placeholder="Who was spoken to?"
        />
        <ComboField
          label="Issue"
          listId="call-issues"
          options={ISSUE_SUGGESTIONS}
          value={form.issue}
          onChange={(e) => set('issue', e.target.value)}
          placeholder="What is the call about?"
        />

        {/* Priority */}
        <div className="sm:col-span-2">
          <p className="field-label mb-1.5">Priority</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => set('priority', '')}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                form.priority === ''
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-ink-300 bg-white text-ink-500 hover:bg-ink-50'
              }`}
            >
              None
            </button>
            {CALL_PRIORITIES.map((p) => {
              const style =
                p === 'P1'
                  ? { on: 'border-red-600 bg-red-600 text-white', off: 'border-red-200 bg-red-50 text-red-700' }
                  : p === 'P2'
                    ? { on: 'border-amber-500 bg-amber-500 text-white', off: 'border-amber-200 bg-amber-50 text-amber-700' }
                    : { on: 'border-sky-600 bg-sky-600 text-white', off: 'border-sky-200 bg-sky-50 text-sky-700' }
              const active = form.priority === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', active ? '' : p)}
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                    active ? style.on : style.off
                  }`}
                >
                  {p}
                </button>
              )
            })}
            {form.priority === 'P1' && (
              <span className="text-[12px] font-medium text-red-600">
                P1 = very urgent — handle today
              </span>
            )}
          </div>
        </div>

        <TextField
          label="Appointment / Visit Date"
          type="date"
          value={form.appointmentDate}
          onChange={(e) => set('appointmentDate', e.target.value)}
          hint="Creates a follow-up reminder on the dashboard"
        />
        <TextField
          label="Distance (km)"
          inputMode="decimal"
          value={form.distanceKm}
          onChange={(e) => set('distanceKm', e.target.value)}
          placeholder="e.g. 12.5"
          hint={linkedCustomer?.distanceKm ? `Saved: ${linkedCustomer.distanceKm} km` : undefined}
        />

        <TextAreaField
          label="Remarks / Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="What was discussed? Quotation requested, visit agreed, follow-up needed…"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useCustomers } from '@/hooks/useData'
import { createCall, updateCall } from '@/services/calls'
import { CALL_SOURCES, CALL_STATUSES, type Call, type CallSource, type CallStatus } from '@/types'
import { todayISO } from '@/utils/format'

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (call: Call) => void
  call?: Call
  /** Pre-select a linked customer (used when creating from a customer). */
  defaultCustomerId?: string
}

interface FormState {
  date: string
  source: CallSource
  status: CallStatus
  customerId: string
  name: string
  phone: string
  notes: string
}

export function CallFormModal({ open, onClose, onSaved, call, defaultCustomerId }: Props) {
  const toast = useToast()
  const customers = useCustomers()
  const [form, setForm] = useState<FormState>({
    date: todayISO(),
    source: 'Direct',
    status: 'New',
    customerId: '',
    name: '',
    phone: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
        phone: call.phone ?? '',
        notes: call.notes ?? '',
      })
    } else {
      setForm({
        date: todayISO(),
        source: 'Direct',
        status: 'New',
        customerId: defaultCustomerId ?? '',
        name: '',
        phone: '',
        notes: '',
      })
    }
  }, [open, call, defaultCustomerId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    const name = form.name.trim()
    if (!name) {
      setError('Caller name is required.')
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
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      }
      const saved = call ? await updateCall(call.id, payload) : await createCall(payload)
      toast.success(call ? 'Call updated' : 'Call logged', `${saved.name} · ${saved.source}`)
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
      title={call ? 'Edit Call' : 'Log a Call'}
      description="Record an enquiry — online, direct or demo — and optionally link it to a customer."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : call ? 'Save Changes' : 'Log Call'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Date"
          type="date"
          required
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
        />
        <SelectField
          label="Call Source"
          value={form.source}
          onChange={(e) => set('source', e.target.value as CallSource)}
          options={[...CALL_SOURCES]}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(e) => set('status', e.target.value as CallStatus)}
          options={[...CALL_STATUSES]}
        />
        <SelectField
          label="Linked Customer"
          value={form.customerId}
          onChange={(e) => set('customerId', e.target.value)}
          hint="Optional — a call can be a new lead"
        >
          <option value="">None (new lead)</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.phone}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Caller Name"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Who called / visited?"
          autoFocus={!call}
        />
        <TextField
          label="Phone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="Mobile / landline"
        />
        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="What was the call about? Quotation requested, demo booked, complaint…"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}

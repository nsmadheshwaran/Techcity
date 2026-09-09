import { useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useCustomers } from '@/hooks/useData'
import { createExpense, updateExpense, type ExpenseInput } from '@/services/expenses'
import { EXPENSE_CATEGORIES, type Expense } from '@/types'
import { todayISO } from '@/utils/format'

interface Props {
  open: boolean
  onClose: () => void
  /** When provided the modal edits this row instead of creating a new one. */
  expense?: Expense
  /** Defaults applied when creating (e.g. opening from a service page). */
  defaultServiceId?: string
  defaultCustomerId?: string
  onSaved?: (expense: Expense) => void
}

export function ExpenseFormModal({
  open,
  onClose,
  expense,
  defaultServiceId,
  defaultCustomerId,
  onSaved,
}: Props) {
  const toast = useToast()
  const customers = useCustomers()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: todayISO(),
    type: 'expense' as 'expense' | 'income',
    category: 'Fuel / Travel',
    title: '',
    amount: '',
    customerId: '',
    notes: '',
  })

  useEffect(() => {
    if (!open) return
    setError('')
    if (expense) {
      setForm({
        date: expense.date,
        type: expense.type,
        category: expense.category || 'Other',
        title: expense.title,
        amount: String(expense.amount ?? ''),
        customerId: expense.customerId ?? '',
        notes: expense.notes ?? '',
      })
    } else {
      setForm({
        date: todayISO(),
        type: 'expense',
        category: 'Fuel / Travel',
        title: '',
        amount: '',
        customerId: defaultCustomerId ?? '',
        notes: '',
      })
    }
  }, [open, expense, defaultCustomerId])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    if (!form.title.trim()) {
      setError('Add a short title (e.g. “Diesel for site visit”).')
      return
    }
    if (!(Number(form.amount) > 0)) {
      setError('Amount must be greater than zero.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: ExpenseInput = {
        date: form.date,
        type: form.type,
        category: form.category,
        title: form.title.trim(),
        amount: form.amount,
        customerId: form.customerId || undefined,
        notes: form.notes.trim(),
        serviceId: defaultServiceId,
      }
      const saved = expense ? await updateExpense(expense.id, payload) : await createExpense(payload)
      toast.success(
        expense ? 'Entry updated' : form.type === 'income' ? 'Earning recorded' : 'Expense recorded',
        `${saved.title} · ₹${saved.amount}`,
      )
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the entry.'
      setError(message)
      toast.error('Save failed', message)
    } finally {
      setSaving(false)
    }
  }

  const isIncome = form.type === 'income'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Edit Entry' : isIncome ? 'Record Earning' : 'Record Expense'}
      description="Track what you spend and what you earn outside the customer bills."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Type toggle */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => set('type', 'expense')}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[13px] font-semibold transition-colors ${
            !isIncome
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
          }`}
        >
          <ArrowDownCircle size={15} /> Money Out
        </button>
        <button
          type="button"
          onClick={() => set('type', 'income')}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[13px] font-semibold transition-colors ${
            isIncome
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
          }`}
        >
          <ArrowUpCircle size={15} /> Money In
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Date"
          type="date"
          required
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
        />
        <TextField
          label="Amount (₹)"
          inputMode="decimal"
          required
          value={form.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="0.00"
          onFocus={(e) => e.currentTarget.select()}
        />
        <SelectField
          label="Category"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          options={[...EXPENSE_CATEGORIES]}
        />
        <TextField
          label={isIncome ? 'Source / Title' : 'What did you spend on?'}
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={isIncome ? 'e.g. Scrap sale, side job' : 'e.g. Diesel for site visit'}
        />
        <SelectField
          label="Customer (optional)"
          value={form.customerId}
          onChange={(e) => set('customerId', e.target.value)}
          className="sm:col-span-2"
          hint="Link this cost to a customer job for reference"
        >
          <option value="">— none —</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.phone}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          placeholder="Anything worth remembering"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}

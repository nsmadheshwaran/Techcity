import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { NumberField, SelectField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { addPayment } from '@/services/services'
import { PAYMENT_METHODS, type PaymentMethod, type Service } from '@/types'
import { formatMoney, todayISO } from '@/utils/format'

export function PaymentModal({
  open,
  onClose,
  service,
  currency = '₹',
}: {
  open: boolean
  onClose: () => void
  service: Service | undefined
  currency?: string
}) {
  const toast = useToast()
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !service) return
    setAmount(Math.max(0, service.balance))
    setMethod(service.paymentMethod ?? 'Cash')
    setDate(todayISO())
    setNote('')
    setError('')
  }, [open, service])

  async function save() {
    if (!service) return
    if (amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (amount > service.balance + 0.001) {
      setError(
        `Amount exceeds the pending balance of ${formatMoney(service.balance, currency)}.`,
      )
      return
    }
    setSaving(true)
    setError('')
    try {
      await addPayment({ serviceId: service.id, amount, method, date, note: note.trim() || undefined })
      toast.success('Payment recorded', `${formatMoney(amount, currency)} received via ${method}.`)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not record the payment.'
      setError(message)
      toast.error('Payment failed', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      description={
        service
          ? `${service.code} · Balance ${formatMoney(service.balance, currency)}`
          : undefined
      }
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <CreditCard size={16} /> {saving ? 'Saving…' : 'Record Payment'}
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
        <NumberField
          label="Amount Received"
          value={amount}
          onValueChange={setAmount}
          currency={currency}
          autoFocus
        />
        <SelectField
          label="Payment Method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          options={PAYMENT_METHODS}
        />
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional reference"
        />
      </div>
    </Modal>
  )
}

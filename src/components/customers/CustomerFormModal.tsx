import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { createCustomer, updateCustomer } from '@/services/customers'
import type { Customer } from '@/types'
import { hasErrors, validateCustomer, type Errors } from '@/utils/validation'

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (customer: Customer) => void
  /** When provided the modal edits this customer instead of creating a new one. */
  customer?: Customer
  /** Pre-fill the name/phone (used when creating from the service form search). */
  initial?: { name?: string; phone?: string }
}

const BLANK = {
  name: '',
  phone: '',
  altPhone: '',
  email: '',
  address: '',
  city: '',
  pincode: '',
  notes: '',
}

export function CustomerFormModal({ open, onClose, onSaved, customer, initial }: Props) {
  const toast = useToast()
  const [form, setForm] = useState({ ...BLANK })
  const [errors, setErrors] = useState<Errors<typeof BLANK>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        altPhone: customer.altPhone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        city: customer.city ?? '',
        pincode: customer.pincode ?? '',
        notes: customer.notes ?? '',
      })
    } else {
      setForm({ ...BLANK, ...initial })
    }
  }, [open, customer, initial])

  const set = (key: keyof typeof BLANK) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function save() {
    const validation = validateCustomer(form)
    setErrors(validation)
    if (hasErrors(validation)) {
      toast.warning('Please fix the highlighted fields')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        altPhone: form.altPhone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      const saved = customer
        ? await updateCustomer(customer.id, payload)
        : await createCustomer(payload)
      toast.success(
        customer ? 'Customer updated' : 'Customer created',
        `${saved.name} · ${saved.code}`,
      )
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast.error(
        customer ? 'Could not update customer' : 'Could not create customer',
        err instanceof Error ? err.message : 'Unexpected error while saving.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : 'Add New Customer'}
      description={
        customer ? `Customer ID ${customer.code}` : 'Only name and phone number are required.'
      }
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : customer ? 'Save Changes' : 'Create Customer'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full Name"
          required
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          error={errors.name}
          placeholder="e.g. Ravi Kumar"
          autoFocus
          className="sm:col-span-2"
        />
        <TextField
          label="Phone Number"
          required
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set('phone')(e.target.value)}
          error={errors.phone}
          placeholder="9876543210"
        />
        <TextField
          label="Alternate Phone"
          type="tel"
          inputMode="tel"
          value={form.altPhone}
          onChange={(e) => set('altPhone')(e.target.value)}
          error={errors.altPhone}
          placeholder="Optional"
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          error={errors.email}
          placeholder="Optional"
          className="sm:col-span-2"
        />
        <TextAreaField
          label="Address"
          value={form.address}
          onChange={(e) => set('address')(e.target.value)}
          rows={2}
          placeholder="Street, area, landmark"
          className="sm:col-span-2"
        />
        <TextField
          label="City"
          value={form.city}
          onChange={(e) => set('city')(e.target.value)}
          placeholder="Coimbatore"
        />
        <TextField
          label="Pincode"
          inputMode="numeric"
          value={form.pincode}
          onChange={(e) => set('pincode')(e.target.value)}
          error={errors.pincode}
          placeholder="641001"
        />
        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(e) => set('notes')(e.target.value)}
          rows={2}
          placeholder="Anything worth remembering about this customer"
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}

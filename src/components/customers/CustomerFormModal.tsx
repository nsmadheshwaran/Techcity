import { useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, Save, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { createCustomer, updateCustomer } from '@/services/customers'
import { saveContactsFor } from '@/services/contacts'
import { getContactsFor } from '@/services/contacts'
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

interface ContactRow {
  id: string
  name: string
  phone: string
  role: string
}

const BLANK = {
  name: '',
  phone: '',
  altPhone: '',
  email: '',
  address: '',
  city: '',
  pincode: '',
  gstNumber: '',
  password: '',
  notes: '',
}

export function CustomerFormModal({ open, onClose, onSaved, customer, initial }: Props) {
  const toast = useToast()
  const [form, setForm] = useState({ ...BLANK })
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [errors, setErrors] = useState<Errors<typeof BLANK>>({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setShowPassword(false)
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        altPhone: customer.altPhone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        city: customer.city ?? '',
        pincode: customer.pincode ?? '',
        gstNumber: customer.gstNumber ?? '',
        password: customer.password ?? '',
        notes: customer.notes ?? '',
      })
      getContactsFor(customer.id).then((rows) =>
        setContacts(
          rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, role: r.role ?? '' })),
        ),
      )
    } else {
      setForm({ ...BLANK, ...initial })
      setContacts([{ id: crypto.randomUUID(), name: '', phone: '', role: '' }])
    }
  }, [open, customer, initial])

  const set = (key: keyof typeof BLANK) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const updateContact = (index: number, patch: Partial<ContactRow>) => {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  const addContact = () => {
    setContacts((prev) => [...prev, { id: crypto.randomUUID(), name: '', phone: '', role: '' }])
  }

  const removeContact = (index: number) => {
    setContacts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function save() {
    // The primary phone/name can come from the first contact if the main
    // fields are left empty — validate against that resolved value.
    const resolvedPhone = form.phone.trim() || contacts[0]?.phone.trim() || ''
    const validation = validateCustomer({ ...form, name: contacts[0]?.name.trim() || '', phone: resolvedPhone })
    setErrors(validation)
    if (hasErrors(validation)) {
      const firstError = Object.values(validation).find(Boolean)
      toast.warning('Please fix the highlighted fields', firstError)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: contacts[0]?.name.trim() || 'Unknown',
        phone: form.phone.trim() || contacts[0]?.phone.trim(),
        altPhone: form.altPhone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        gstNumber: form.gstNumber.trim() || undefined,
        password: form.password.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      let saved: Customer
      if (customer) {
        saved = await updateCustomer(customer.id, payload)
        await saveContactsFor(
          customer.id,
          contacts.map((c) => ({ name: c.name, phone: c.phone, role: c.role })),
        )
      } else {
        saved = await createCustomer(payload)
        await saveContactsFor(
          saved.id,
          contacts.map((c) => ({ name: c.name, phone: c.phone, role: c.role })),
        )
      }
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
        customer
          ? `Customer ID ${customer.code}`
          : 'Add one or more contacts. Name and phone of the first contact are required.'
      }
      size="lg"
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
      {/* Contacts */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="field-label mb-0">Contacts</label>
          <button type="button" className="btn-ghost px-2 py-1 text-[12.5px]" onClick={addContact}>
            <Plus size={14} /> Add contact
          </button>
        </div>
        <div className="space-y-2">
          {contacts.map((c, i) => (
            <div key={c.id} className="grid grid-cols-12 items-start gap-2">
              <div className="col-span-12 sm:col-span-4">
                <label className="field-label" htmlFor={`ct-${c.id}-name`}>{i === 0 ? 'Name *' : 'Name'}</label>
                <input
                  id={`ct-${c.id}-name`}
                  className="input"
                  placeholder="Contact name"
                  value={c.name}
                  onChange={(e) => updateContact(i, { name: e.target.value })}
                  autoFocus={i === 0 && !customer}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <label className="field-label" htmlFor={`ct-${c.id}-phone`}>{i === 0 ? 'Phone *' : 'Phone'}</label>
                <input
                  id={`ct-${c.id}-phone`}
                  className="input"
                  placeholder="Phone number"
                  value={c.phone}
                  onChange={(e) => updateContact(i, { phone: e.target.value })}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <label className="field-label" htmlFor={`ct-${c.id}-role`}>Role</label>
                <input
                  id={`ct-${c.id}-role`}
                  className="input"
                  placeholder="Owner, Manager…"
                  value={c.role}
                  onChange={(e) => updateContact(i, { role: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex items-end sm:col-span-2">
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  disabled={contacts.length <= 1}
                  className="flex h-[42px] w-full items-center justify-center rounded-lg border border-ink-300 text-ink-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:border-ink-300 disabled:hover:bg-transparent disabled:hover:text-ink-400"
                  aria-label="Remove contact"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          placeholder="Optional"
        />
        <TextField
          label="GST Number"
          value={form.gstNumber}
          onChange={(e) => set('gstNumber')(e.target.value)}
          placeholder="e.g. 33ABCDE1234F1Z5"
        />
        <TextField
          label="Alternate Phone"
          type="tel"
          inputMode="tel"
          value={form.altPhone}
          onChange={(e) => set('altPhone')(e.target.value)}
          placeholder="Optional"
        />
        <div>
          <label className="field-label">Equipment Password</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder="Camera / DVR / network password"
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1 text-[12px] text-ink-500">
            Stored locally so you can view it anytime. Revealed with the eye icon.
          </p>
        </div>
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

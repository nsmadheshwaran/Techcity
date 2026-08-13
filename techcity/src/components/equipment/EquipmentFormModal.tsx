import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ComboField, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { createEquipment, updateEquipment } from '@/services/equipment'
import { useCustomers, useSettingsWithStatus } from '@/hooks/useData'
import { EQUIPMENT_STATUSES, type Equipment } from '@/types'
import { todayISO, warrantyExpiryFrom } from '@/utils/format'

const PRODUCT_TYPES = [
  'Camera',
  'DVR',
  'NVR',
  'Desktop',
  'Laptop',
  'Printer',
  'Router',
  'Switch',
  'UPS',
  'Hard Disk',
  'Monitor',
  'Other',
]

const WARRANTY_OPTIONS = ['No Warranty', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years']

interface Props {
  open: boolean
  onClose: () => void
  equipment?: Equipment
  defaultCustomerId?: string
  onSaved?: (e: Equipment) => void
}

export function EquipmentFormModal({ open, onClose, equipment, defaultCustomerId, onSaved }: Props) {
  const toast = useToast()
  const customers = useCustomers()
  const { settings, loaded: settingsLoaded } = useSettingsWithStatus()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    productType: 'Camera',
    brand: '',
    model: '',
    serialNumber: '',
    installationDate: todayISO(),
    warrantyPeriod: settings.defaultWarrantyPeriod || '1 Year',
    location: '',
    status: 'Active' as Equipment['status'],
    notes: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !settingsLoaded) return
    setError('')
    if (equipment) {
      setForm({
        customerId: equipment.customerId,
        productType: equipment.productType,
        brand: equipment.brand ?? '',
        model: equipment.model ?? '',
        serialNumber: equipment.serialNumber ?? '',
        installationDate: equipment.installationDate ?? todayISO(),
        warrantyPeriod: equipment.warrantyPeriod ?? '',
        location: equipment.location ?? '',
        status: equipment.status,
        notes: equipment.notes ?? '',
      })
    } else {
      setForm((f) => ({
        ...f,
        customerId: defaultCustomerId ?? '',
        productType: 'Camera',
        brand: '',
        model: '',
        serialNumber: '',
        installationDate: todayISO(),
        warrantyPeriod: settings.defaultWarrantyPeriod || '1 Year',
        location: '',
        status: 'Active',
        notes: '',
      }))
    }
  }, [open, equipment, defaultCustomerId, settings.defaultWarrantyPeriod, settingsLoaded])

  const expiry = warrantyExpiryFrom(form.installationDate, form.warrantyPeriod)

  async function save() {
    if (!form.customerId) {
      setError('Please select the customer this equipment belongs to.')
      return
    }
    if (!form.productType.trim()) {
      setError('Product type is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        customerId: form.customerId,
        productType: form.productType.trim(),
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        installationDate: form.installationDate || undefined,
        warrantyPeriod: form.warrantyPeriod.trim() || undefined,
        location: form.location.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }
      const saved = equipment
        ? await updateEquipment(equipment.id, payload)
        : await createEquipment(payload)
      toast.success(equipment ? 'Equipment updated' : 'Equipment added', saved.code)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the equipment record.'
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
      title={equipment ? `Edit ${equipment.code}` : 'Add Equipment'}
      description="Track devices installed at a customer site."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Equipment'}
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
        <SelectField
          label="Customer"
          required
          value={form.customerId}
          onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
          className="sm:col-span-2"
          disabled={Boolean(equipment)}
        >
          <option value="">Select a customer…</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.phone}
            </option>
          ))}
        </SelectField>

        <ComboField
          label="Product Type"
          required
          listId="equipment-types"
          options={PRODUCT_TYPES}
          value={form.productType}
          onChange={(e) => setForm((f) => ({ ...f, productType: e.target.value }))}
          placeholder="Camera"
        />
        <TextField
          label="Brand"
          value={form.brand}
          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          placeholder="Hikvision"
        />
        <TextField
          label="Model"
          value={form.model}
          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          placeholder="DS-2CD1343G0-I"
        />
        <TextField
          label="Serial Number"
          value={form.serialNumber}
          onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
          placeholder="Optional"
        />
        <TextField
          label="Installation Date"
          type="date"
          value={form.installationDate}
          onChange={(e) => setForm((f) => ({ ...f, installationDate: e.target.value }))}
        />
        <ComboField
          label="Warranty"
          listId="equipment-warranty"
          options={WARRANTY_OPTIONS}
          value={form.warrantyPeriod}
          onChange={(e) => setForm((f) => ({ ...f, warrantyPeriod: e.target.value }))}
          hint={expiry ? `Expires on ${expiry}` : 'e.g. 1 Year, 6 Months'}
        />
        <TextField
          label="Location"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          placeholder="Shop entrance / Block A"
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Equipment['status'] }))}
          options={EQUIPMENT_STATUSES}
        />
        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="sm:col-span-2"
        />
      </div>
    </Modal>
  )
}

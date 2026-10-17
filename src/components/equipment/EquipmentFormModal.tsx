import { useEffect, useId, useState } from 'react'
import { Eye, EyeOff, Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ComboField, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { PhotoPicker, PhotoZoomOverlay } from '@/components/ui/PhotoPicker'
import { useToast } from '@/components/ui/Toast'
import { createEquipment, updateEquipment } from '@/services/equipment'
import { useCustomers, useEquipment, useSettingsWithStatus } from '@/hooks/useData'
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
  'RAM',
  'Motherboard',
  'Monitor',
  'Other',
]

const WARRANTY_OPTIONS = ['No Warranty', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years']

interface Props {
  open: boolean
  onClose: () => void
  equipment?: Equipment
  defaultCustomerId?: string
  /** Pre-selects a parent device — used by "Add Component" on an existing device. */
  defaultParentEquipmentId?: string
  onSaved?: (e: Equipment) => void
}

export function EquipmentFormModal({
  open,
  onClose,
  equipment,
  defaultCustomerId,
  defaultParentEquipmentId,
  onSaved,
}: Props) {
  const toast = useToast()
  const passwordId = useId()
  const customers = useCustomers()
  const { settings, loaded: settingsLoaded } = useSettingsWithStatus()
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [zoomPhoto, setZoomPhoto] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    parentEquipmentId: '',
    productType: 'Camera',
    brand: '',
    model: '',
    serialNumber: '',
    installationDate: todayISO(),
    warrantyPeriod: settings.defaultWarrantyPeriod || '1 Year',
    location: '',
    status: 'Active' as Equipment['status'],
    password: '',
    photoDataUrl: '',
    notes: '',
  })
  const [error, setError] = useState('')

  // Candidate parent devices: every top-level item (no parent of its own)
  // belonging to the same customer, excluding this record itself. One level
  // of nesting only, so a component can never become a parent.
  const customerEquipment = useEquipment(form.customerId || undefined)
  const parentOptions = (customerEquipment ?? []).filter(
    (e) => !e.parentEquipmentId && e.id !== equipment?.id,
  )

  useEffect(() => {
    if (!open || !settingsLoaded) return
    setError('')
    setShowPassword(false)
    if (equipment) {
      setForm({
        customerId: equipment.customerId,
        parentEquipmentId: equipment.parentEquipmentId ?? '',
        productType: equipment.productType,
        brand: equipment.brand ?? '',
        model: equipment.model ?? '',
        serialNumber: equipment.serialNumber ?? '',
        installationDate: equipment.installationDate ?? todayISO(),
        warrantyPeriod: equipment.warrantyPeriod ?? '',
        location: equipment.location ?? '',
        status: equipment.status,
        password: equipment.password ?? '',
        photoDataUrl: equipment.photoDataUrl ?? '',
        notes: equipment.notes ?? '',
      })
    } else {
      setForm((f) => ({
        ...f,
        customerId: defaultCustomerId ?? '',
        parentEquipmentId: defaultParentEquipmentId ?? '',
        productType: 'Camera',
        brand: '',
        model: '',
        serialNumber: '',
        installationDate: todayISO(),
        warrantyPeriod: settings.defaultWarrantyPeriod || '1 Year',
        location: '',
        status: 'Active',
        password: '',
        photoDataUrl: '',
        notes: '',
      }))
    }
  }, [
    open,
    equipment,
    defaultCustomerId,
    defaultParentEquipmentId,
    settings.defaultWarrantyPeriod,
    settingsLoaded,
  ])

  const expiry = warrantyExpiryFrom(form.installationDate, form.warrantyPeriod)
  const parent = parentOptions.find((p) => p.id === form.parentEquipmentId)

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
        parentEquipmentId: form.parentEquipmentId || undefined,
        productType: form.productType.trim(),
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        installationDate: form.installationDate || undefined,
        warrantyPeriod: form.warrantyPeriod.trim() || undefined,
        location: form.location.trim() || undefined,
        status: form.status,
        password: form.password.trim() || undefined,
        photoDataUrl: form.photoDataUrl || undefined,
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
      title={equipment ? `Edit ${equipment.code}` : parent ? `Add Component to ${parent.productType}` : 'Add Equipment'}
      description="Track devices and their components installed at a customer site."
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
          onChange={(e) =>
            setForm((f) => ({ ...f, customerId: e.target.value, parentEquipmentId: '' }))
          }
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

        <SelectField
          label="Part Of"
          hint="Leave blank for a standalone device. Pick a device here to record this as one of its components — a RAM stick, a hard disk, a camera on a shared DVR."
          value={form.parentEquipmentId}
          onChange={(e) => setForm((f) => ({ ...f, parentEquipmentId: e.target.value }))}
          className="sm:col-span-2"
          disabled={!form.customerId}
        >
          <option value="">— Standalone device —</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.productType}
              {p.brand ? ` · ${p.brand}` : ''} ({p.code})
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

        <div>
          <label className="field-label" htmlFor={passwordId}>
            Login / Password
          </label>
          <div className="relative">
            <input
              id={passwordId}
              className="input pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder="Router admin / DVR / Windows login"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
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
          <p className="mt-1 text-[12px] text-ink-500">Specific to this item. Revealed with the eye icon.</p>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label">Photo</label>
          <PhotoPicker
            photo={form.photoDataUrl || undefined}
            onPicked={(dataUrl) => setForm((f) => ({ ...f, photoDataUrl: dataUrl ?? '' }))}
            onZoom={() => setZoomPhoto(true)}
            label={form.productType || 'equipment'}
          />
        </div>

        <TextAreaField
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="sm:col-span-2"
        />
      </div>

      {zoomPhoto && form.photoDataUrl && (
        <PhotoZoomOverlay
          src={form.photoDataUrl}
          alt={`Photo of ${form.productType || 'equipment'}`}
          onClose={() => setZoomPhoto(false)}
        />
      )}
    </Modal>
  )
}

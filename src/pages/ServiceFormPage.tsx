import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PhoneCall, Save, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CustomerPicker } from '@/components/services/CustomerPicker'
import { PartsEditor } from '@/components/services/PartsEditor'
import {
  ComboField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useService, useServiceParts, useSettingsWithStatus, useTechnicians } from '@/hooks/useData'
import { getCall, updateCall } from '@/services/calls'
import {
  computeTotals,
  createService,
  updateService,
  type PartDraft,
} from '@/services/services'
import {
  PAYMENT_METHODS,
  SERVICE_MODES,
  SERVICE_STATUSES,
  type PaymentMethod,
  type ServiceMode,
  type ServiceStatus,
} from '@/types'
import { formatMoney, formatDate, todayISO, warrantyExpiryFrom } from '@/utils/format'
import { hasErrors, validateService, type Errors } from '@/utils/validation'

const WARRANTY_OPTIONS = [
  'No Warranty',
  '15 Days',
  '1 Month',
  '3 Months',
  '6 Months',
  '1 Year',
  '2 Years',
]

const DEVICE_OPTIONS = [
  'Laptop',
  'Desktop',
  'CCTV System',
  'CCTV Camera',
  'DVR',
  'NVR',
  'Printer',
  'Router',
  'Hard Disk',
  'Monitor',
  'UPS',
  'Other',
]

interface FormState {
  customerId: string
  serviceDate: string
  finishedDate: string
  serviceType: string
  status: ServiceStatus
  serviceMode: ServiceMode
  product: string
  brand: string
  model: string
  serialNumber: string
  complaint: string
  diagnosis: string
  workPerformed: string
  technician: string
  serviceCharge: number
  partsCost: number
  deliveryCharge: number
  discount: number
  taxPercent: number
  amountPaid: number
  paymentMethod: PaymentMethod | ''
  warrantyPeriod: string
  warrantyExpiry: string
  nextServiceDate: string
  notes: string
}

export default function ServiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { settings, loaded: settingsLoaded } = useSettingsWithStatus()
  const technicians = useTechnicians()
  const existing = useService(id)
  const existingParts = useServiceParts(id)
  const isEdit = Boolean(id)

  /** Booked call this service was started from (services/new?callId=…). */
  const callId = searchParams.get('callId')
  const [sourceCall, setSourceCall] = useState<Awaited<ReturnType<typeof getCall>>>(undefined)

  const [form, setForm] = useState<FormState>(() => ({
    customerId: searchParams.get('customerId') ?? '',
    serviceDate: todayISO(),
    finishedDate: '',
    serviceType: '',
    status: 'Received',
    serviceMode: 'Offline',
    product: '',
    brand: '',
    model: '',
    serialNumber: '',
    complaint: '',
    diagnosis: '',
    workPerformed: '',
    technician: '',
    serviceCharge: 0,
    partsCost: 0,
    deliveryCharge: 0,
    discount: 0,
    taxPercent: 0,
    amountPaid: 0,
    paymentMethod: '',
    warrantyPeriod: '',
    warrantyExpiry: '',
    nextServiceDate: '',
    notes: '',
  }))
  const [parts, setParts] = useState<PartDraft[]>([])
  const [errors, setErrors] = useState<Errors<FormState>>({})
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [autoPartsCost, setAutoPartsCost] = useState(true)

  // Apply defaults from settings once, for a new record.
  const defaultsApplied = useRef(false)
  useEffect(() => {
    // Wait for the saved settings row so we apply the business's own defaults,
    // not the built-in fallbacks.
    if (isEdit || defaultsApplied.current || !settingsLoaded) return
    defaultsApplied.current = true
    setForm((f) => ({
      ...f,
      technician: f.technician || settings.defaultTechnician || '',
      warrantyPeriod: f.warrantyPeriod || settings.defaultWarrantyPeriod || '',
      taxPercent: settings.gstEnabled ? settings.defaultTaxPercent : 0,
    }))
  }, [isEdit, settings, settingsLoaded])

  // Prefill from a booked call (Call Book → “Book Service”): the linked
  // customer plus the reported issue as the complaint.
  const callPrefilled = useRef(false)
  useEffect(() => {
    if (!callId || callPrefilled.current) return
    callPrefilled.current = true
    getCall(callId)
      .then((c) => {
        if (!c) return
        setSourceCall(c)
        setForm((f) => ({
          ...f,
          customerId: f.customerId || c.customerId || '',
          complaint: f.complaint || c.issue || '',
          notes: f.notes || (c.notes ? `From call: ${c.notes}` : ''),
        }))
      })
      .catch(() => undefined)
  }, [callId])

  // Hydrate the form when editing an existing service.
  useEffect(() => {
    if (!isEdit || !existing || hydrated) return
    setForm({
      customerId: existing.customerId,
      serviceDate: existing.serviceDate,
      finishedDate: existing.finishedDate ?? '',
      serviceType: existing.serviceType,
      status: existing.status,
      serviceMode: existing.serviceMode ?? 'Offline',
      product: existing.product ?? '',
      brand: existing.brand ?? '',
      model: existing.model ?? '',
      serialNumber: existing.serialNumber ?? '',
      complaint: existing.complaint,
      diagnosis: existing.diagnosis ?? '',
      workPerformed: existing.workPerformed ?? '',
      technician: existing.technician ?? '',
      serviceCharge: existing.serviceCharge,
      partsCost: existing.partsCost,
      deliveryCharge: existing.deliveryCharge ?? 0,
      discount: existing.discount,
      taxPercent: existing.taxPercent ?? 0,
      amountPaid: existing.amountPaid,
      paymentMethod: existing.paymentMethod ?? '',
      warrantyPeriod: existing.warrantyPeriod ?? '',
      warrantyExpiry: existing.warrantyExpiry ?? '',
      nextServiceDate: existing.nextServiceDate ?? '',
      notes: existing.notes ?? '',
    })
    setAutoPartsCost(false)
    setHydrated(true)
  }, [isEdit, existing, hydrated])

  const partsHydrated = useRef(false)
  useEffect(() => {
    if (!isEdit || partsHydrated.current || !existingParts) return
    partsHydrated.current = true
    setParts(
      existingParts.map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        photoDataUrl: p.photoDataUrl,
      })),
    )
  }, [isEdit, existingParts])

  // Keep parts cost in sync with itemised parts (until manually overridden).
  const partsTotal = useMemo(
    () => parts.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0), 0),
    [parts],
  )
  useEffect(() => {
    if (!autoPartsCost) return
    setForm((f) => (f.partsCost === partsTotal ? f : { ...f, partsCost: partsTotal }))
  }, [partsTotal, autoPartsCost])

  const totals = useMemo(
    () =>
      computeTotals({
        serviceCharge: form.serviceCharge,
        partsCost: form.partsCost,
        deliveryCharge: form.deliveryCharge,
        discount: form.discount,
        taxPercent: settings.gstEnabled ? form.taxPercent : 0,
        amountPaid: form.amountPaid,
      }),
    [form, settings.gstEnabled],
  )

  const derivedWarrantyExpiry =
    form.warrantyExpiry || warrantyExpiryFrom(form.serviceDate, form.warrantyPeriod) || ''

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function onSubmit(markCompleted = false) {
    const status: ServiceStatus = markCompleted ? 'Completed' : form.status
    const validation = validateService({
      customerId: form.customerId,
      serviceDate: form.serviceDate,
      serviceType: form.serviceType,
      complaint: form.complaint,
      serviceCharge: form.serviceCharge,
      partsCost: form.partsCost,
      discount: form.discount,
      amountPaid: form.amountPaid,
      total: totals.totalAmount,
    })
    setErrors(validation)
    if (hasErrors(validation)) {
      toast.warning('Please fix the highlighted fields', 'Some required information is missing.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        customerId: form.customerId,
        serviceDate: form.serviceDate,
        finishedDate: form.finishedDate || undefined,
        serviceType: form.serviceType.trim(),
        status,
        serviceMode: form.serviceMode,
        product: form.product.trim() || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        complaint: form.complaint.trim(),
        diagnosis: form.diagnosis.trim() || undefined,
        workPerformed: form.workPerformed.trim() || undefined,
        technician: form.technician.trim() || undefined,
        serviceCharge: form.serviceCharge,
        partsCost: form.partsCost,
        deliveryCharge: form.deliveryCharge,
        discount: form.discount,
        taxPercent: settings.gstEnabled ? form.taxPercent : 0,
        amountPaid: form.amountPaid,
        paymentMethod: (form.paymentMethod || undefined) as PaymentMethod | undefined,
        warrantyPeriod: form.warrantyPeriod.trim() || undefined,
        warrantyExpiry: derivedWarrantyExpiry || undefined,
        nextServiceDate: form.nextServiceDate || undefined,
        notes: form.notes.trim() || undefined,
      }

      if (isEdit && id) {
        const updated = await updateService(id, payload, parts)
        toast.success('Service updated', `${updated.code} saved successfully.`)
        navigate(`/services/${id}`)
      } else {
        const created = await createService(payload, parts)
        toast.success('Service saved', `${created.code} created successfully.`)
        // The service was started from a booked call — close the loop by
        // marking that call completed.
        if (callId) {
          try {
            await updateCall(callId, { status: 'Completed' })
          } catch {
            // Never block saving the service on the call-status update.
          }
        }
        navigate(`/services/${created.id}?created=1`)
      }
    } catch (err) {
      toast.error(
        'Could not save the service',
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && existing === undefined) return <LoadingState label="Loading service…" />

  return (
    <>
      <PageHeader
        back={isEdit ? `/services/${id}` : '/services'}
        title={isEdit ? `Edit Service ${existing?.code ?? ''}` : 'New Service Entry'}
        subtitle={
          isEdit
            ? 'Update the service record. Totals and reminders recalculate automatically.'
            : 'Record a service in under two minutes — only a few fields are required.'
        }
      />

      {!isEdit && sourceCall && (
        <div className="card mb-4 flex items-start gap-3 border-brand-200 bg-brand-50/60 p-3.5">
          <PhoneCall size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink-900">
              Booking service from call: {sourceCall.name}
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-600">
              {formatDate(sourceCall.date)}
              {sourceCall.issue ? ` · ${sourceCall.issue}` : ''} — saving this service marks the
              call as Completed.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(false)
        }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="space-y-4 lg:col-span-2">
          {/* Customer */}
          <section className="card p-4">
            <CustomerPicker
              value={form.customerId}
              onChange={(v) => set('customerId', v)}
              error={errors.customerId}
            />
          </section>

          {/* Service info */}
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink-900">
              <Wrench size={16} className="text-brand-600" /> Service Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {isEdit && (
                <TextField label="Service ID" value={existing?.code ?? ''} disabled readOnly />
              )}
              <TextField
                label="Service Date"
                type="date"
                required
                value={form.serviceDate}
                onChange={(e) => set('serviceDate', e.target.value)}
                error={errors.serviceDate}
              />
              <TextField
                label="Finished Date"
                type="date"
                value={form.finishedDate}
                onChange={(e) => set('finishedDate', e.target.value)}
                hint="Leave empty while work is ongoing"
              />
              <ComboField
                label="Service Type"
                required
                listId="service-types"
                options={settings.serviceTypes}
                value={form.serviceType}
                onChange={(e) => set('serviceType', e.target.value)}
                error={errors.serviceType}
                placeholder="Select or type a service type"
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as ServiceStatus)}
                options={SERVICE_STATUSES}
              />
              <SelectField
                label="Service Mode"
                value={form.serviceMode}
                onChange={(e) => set('serviceMode', e.target.value as ServiceMode)}
                options={SERVICE_MODES}
                hint="On-site or remote"
              />
              <ComboField
                label="Technician"
                listId="technicians"
                options={technicians}
                value={form.technician}
                onChange={(e) => set('technician', e.target.value)}
                placeholder="Who is handling this?"
              />
              <ComboField
                label="Product / Device"
                listId="device-types"
                options={DEVICE_OPTIONS}
                value={form.product}
                onChange={(e) => set('product', e.target.value)}
                placeholder="Laptop, CCTV camera…"
              />
              <TextField
                label="Brand"
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="HP, Hikvision…"
              />
              <TextField
                label="Model"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="Model number"
              />
              <TextField
                label="Serial Number"
                value={form.serialNumber}
                onChange={(e) => set('serialNumber', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </section>

          {/* Work details */}
          <section className="card space-y-4 p-4">
            <h2 className="text-[15px] font-semibold text-ink-900">Work Details</h2>
            <TextAreaField
              label="Complaint / Problem Reported"
              required
              value={form.complaint}
              onChange={(e) => set('complaint', e.target.value)}
              error={errors.complaint}
              placeholder="What did the customer report?"
              rows={2}
            />
            <TextAreaField
              label="Diagnosis"
              value={form.diagnosis}
              onChange={(e) => set('diagnosis', e.target.value)}
              placeholder="What was found during inspection?"
              rows={2}
            />
            <TextAreaField
              label="Work Performed"
              value={form.workPerformed}
              onChange={(e) => set('workPerformed', e.target.value)}
              placeholder="What was actually done?"
              rows={2}
            />
            <PartsEditor
              parts={parts}
              onChange={(p) => {
                setParts(p)
                setAutoPartsCost(true)
              }}
              currency={settings.currency}
            />
          </section>

          {/* Warranty and follow up */}
          <section className="card p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Warranty & Next Service</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <ComboField
                label="Warranty Period"
                listId="warranty-periods"
                options={WARRANTY_OPTIONS}
                value={form.warrantyPeriod}
                onChange={(e) => set('warrantyPeriod', e.target.value)}
                placeholder="3 Months"
              />
              <TextField
                label="Warranty Expiry"
                type="date"
                value={derivedWarrantyExpiry}
                onChange={(e) => set('warrantyExpiry', e.target.value)}
                hint="Calculated automatically"
              />
              <TextField
                label="Next Service Date"
                type="date"
                value={form.nextServiceDate}
                onChange={(e) => set('nextServiceDate', e.target.value)}
                hint="Creates a reminder"
              />
            </div>
            <TextAreaField
              label="Additional Notes"
              className="mt-4"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Anything else to record on the report"
            />
          </section>
        </div>

        {/* Billing sidebar */}
        <div className="space-y-4">
          <section className="card p-4 lg:sticky lg:top-20">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Charges & Payment</h2>
            <div className="space-y-3.5">
              <NumberField
                label="Service Charge"
                value={form.serviceCharge}
                onValueChange={(v) => set('serviceCharge', v)}
                error={errors.serviceCharge}
                currency={settings.currency}
              />
              <NumberField
                label="Parts Cost"
                value={form.partsCost}
                onValueChange={(v) => {
                  setAutoPartsCost(false)
                  set('partsCost', v)
                }}
                error={errors.partsCost}
                currency={settings.currency}
                hint={parts.length ? 'Auto-filled from the parts list' : undefined}
              />
              <NumberField
                label="Delivery / Travel Charge"
                value={form.deliveryCharge}
                onValueChange={(v) => set('deliveryCharge', v)}
                error={errors.deliveryCharge}
                currency={settings.currency}
                hint="Added to the customer total"
              />
              <NumberField
                label="Discount"
                value={form.discount}
                onValueChange={(v) => set('discount', v)}
                error={errors.discount}
                currency={settings.currency}
              />
              {settings.gstEnabled && (
                <NumberField
                  label="Tax / GST %"
                  value={form.taxPercent}
                  onValueChange={(v) => set('taxPercent', v)}
                  currency={null}
                  step="0.01"
                />
              )}

              <div className="rounded-lg bg-ink-50 p-3">
                <div className="flex items-center justify-between text-[13px] text-ink-600">
                  <span>Subtotal</span>
                  <span>{formatMoney(totals.subtotal, settings.currency)}</span>
                </div>
                {form.deliveryCharge > 0 && (
                  <div className="mt-1 flex items-center justify-between text-[13px] text-ink-600">
                    <span>Incl. delivery / travel</span>
                    <span>{formatMoney(form.deliveryCharge, settings.currency)}</span>
                  </div>
                )}
                {settings.gstEnabled && form.taxPercent > 0 && (
                  <div className="mt-1 flex items-center justify-between text-[13px] text-ink-600">
                    <span>Tax ({form.taxPercent}%)</span>
                    <span>{formatMoney(totals.taxAmount, settings.currency)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-ink-200 pt-2">
                  <span className="text-[13.5px] font-semibold text-ink-900">Total Amount</span>
                  <span className="text-lg font-bold tracking-tight text-ink-900">
                    {formatMoney(totals.totalAmount, settings.currency)}
                  </span>
                </div>
              </div>

              <NumberField
                label="Amount Paid"
                value={form.amountPaid}
                onValueChange={(v) => set('amountPaid', v)}
                error={errors.amountPaid}
                currency={settings.currency}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1 py-1.5 text-[12.5px]"
                  onClick={() => set('amountPaid', totals.totalAmount)}
                >
                  Paid in full
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1 py-1.5 text-[12.5px]"
                  onClick={() => set('amountPaid', 0)}
                >
                  Not paid
                </button>
              </div>

              <SelectField
                label="Payment Method"
                value={form.paymentMethod}
                onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}
              >
                <option value="">Not specified</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SelectField>

              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                  totals.balance > 0
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <span className="text-[13px] font-medium">Balance</span>
                <span className="text-[15px] font-bold">
                  {formatMoney(totals.balance, settings.currency)}
                </span>
              </div>
              <p className="text-center text-[12px] text-ink-500">
                Payment status: <span className="font-medium">{totals.paymentStatus}</span>
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Service'}
              </button>
              {!isEdit && (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  disabled={saving}
                  onClick={() => onSubmit(true)}
                >
                  Save & mark completed
                </button>
              )}
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => navigate(isEdit ? `/services/${id}` : '/services')}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      </form>
    </>
  )
}

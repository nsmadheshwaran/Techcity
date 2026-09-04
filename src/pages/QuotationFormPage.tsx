import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Save, Trash2, ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CustomerPicker } from '@/components/services/CustomerPicker'
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useQuotation, useSettingsWithStatus } from '@/hooks/useData'
import { computeQuotationTotals, createQuotation, updateQuotation } from '@/services/quotations'
import { QUOTATION_STATUSES, type QuotationStatus } from '@/types'
import { addDays, formatMoney, todayISO } from '@/utils/format'

interface ItemRow {
  id: string
  name: string
  quantity: number
  unitPrice: number
}

interface FormState {
  customerId: string
  date: string
  validUntil: string
  status: QuotationStatus
  discount: number
  taxPercent: number
  notes: string
}

export default function QuotationFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { settings, loaded: settingsLoaded } = useSettingsWithStatus()
  const existing = useQuotation(id)
  const isEdit = Boolean(id)

  const [form, setForm] = useState<FormState>(() => ({
    customerId: searchParams.get('customerId') ?? '',
    date: todayISO(),
    validUntil: addDays(todayISO(), 30),
    status: 'Draft',
    discount: 0,
    taxPercent: settings.gstEnabled ? settings.defaultTaxPercent : 0,
    notes: '',
  }))
  const [items, setItems] = useState<ItemRow[]>([blankItem()])
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit || !existing || hydrated || !settingsLoaded) return
    setForm({
      customerId: existing.customerId,
      date: existing.date,
      validUntil: existing.validUntil ?? '',
      status: existing.status,
      discount: existing.discount,
      taxPercent: existing.taxPercent,
      notes: existing.notes ?? '',
    })
    setItems(
      existing.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    )
    setHydrated(true)
  }, [isEdit, existing, hydrated, settingsLoaded])

  // When GST is switched on later, adopt the default tax rate for new rows.
  useEffect(() => {
    if (!isEdit && settings.gstEnabled && form.taxPercent === 0) {
      setForm((f) => ({ ...f, taxPercent: settings.defaultTaxPercent }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gstEnabled, settings.defaultTaxPercent, isEdit])

  const totals = useMemo(() => computeQuotationTotals(items, form.discount, form.taxPercent), [items, form.discount, form.taxPercent])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function blankItem(): ItemRow {
    return { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 }
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  async function onSave() {
    if (!form.customerId) {
      toast.warning('Select a customer', 'A quotation must be linked to a customer.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!items.some((i) => i.name.trim())) {
      toast.warning('Add an item', 'Enter at least one item description.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        customerId: form.customerId,
        date: form.date,
        validUntil: form.validUntil || undefined,
        status: form.status,
        items: items
          .filter((i) => i.name.trim())
          .map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        discount: form.discount,
        taxPercent: settings.gstEnabled ? form.taxPercent : 0,
        notes: form.notes,
      }
      if (isEdit && id) {
        await updateQuotation(id, payload)
        toast.success('Quotation updated', 'Changes saved.')
      } else {
        const created = await createQuotation(payload)
        toast.success('Quotation created', `${created.code} · Total ${formatMoney(created.totalAmount, settings.currency)}`)
      }
      navigate('/quotations')
    } catch (err) {
      toast.error('Could not save the quotation', err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && existing === undefined) return <LoadingState label="Loading quotation…" />

  const total = totals.totalAmount

  return (
    <>
      <PageHeader
        back="/quotations"
        title={isEdit ? `Edit ${existing?.code ?? 'Quotation'}` : 'New Quotation'}
        subtitle={
          isEdit
            ? 'Update the items, amounts or validity of this quotation.'
            : 'Build a quotation from a customer’s saved details and send it as a PDF.'
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <CustomerPicker
              value={form.customerId}
              onChange={(v) => set('customerId', v)}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <TextField label="Quotation Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              <TextField label="Valid Until" type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as QuotationStatus)}
                options={[...QUOTATION_STATUSES]}
              />
            </div>
          </section>

          {/* Items */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
                <ScrollText size={16} className="text-brand-600" /> Quotation Items
              </h2>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-[12.5px]"
                onClick={() => setItems((prev) => [...prev, blankItem()])}
              >
                <Plus size={14} /> Add item
              </button>
            </div>
            <div className="space-y-2">
              <div className="hidden grid-cols-12 gap-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-400 sm:grid">
                <div className="col-span-6">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                  <input
                    className="input col-span-12 sm:col-span-6"
                    placeholder="Item description (e.g. 2MP CCTV camera + installation)"
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                  />
                  <input
                    className="input col-span-4 sm:col-span-2"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Quantity"
                  />
                  <input
                    className="input col-span-4 sm:col-span-2"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Unit rate"
                  />
                  <div className="col-span-3 text-right text-[13px] font-medium text-ink-700 sm:col-span-1">
                    {formatMoney(item.quantity * item.unitPrice)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))}
                    disabled={items.length <= 1}
                    className="btn-ghost col-span-1 justify-self-end px-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    aria-label="Remove item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <TextAreaField
              label="Notes"
              className="mt-4"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Validity, delivery timeline, warranty offered…"
            />
          </section>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <section className="card p-4 lg:sticky lg:top-20">
            <h2 className="mb-3 text-[15px] font-semibold text-ink-900">Totals</h2>
            <NumberField
              label="Discount"
              value={form.discount}
              onValueChange={(v) => set('discount', v)}
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
            <div className="mt-3 rounded-lg bg-ink-50 p-3">
              <div className="flex items-center justify-between text-[13px] text-ink-600">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotal, settings.currency)}</span>
              </div>
              {settings.gstEnabled && form.taxPercent > 0 && (
                <div className="mt-1 flex items-center justify-between text-[13px] text-ink-600">
                  <span>Tax ({form.taxPercent}%)</span>
                  <span>{formatMoney(totals.taxAmount, settings.currency)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-ink-200 pt-2">
                <span className="text-[13.5px] font-semibold text-ink-900">Grand Total</span>
                <span className="text-lg font-bold tracking-tight text-ink-900">
                  {formatMoney(total, settings.currency)}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <button className="btn-primary w-full" onClick={onSave} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quotation'}
              </button>
              <button className="btn-ghost w-full" onClick={() => navigate('/quotations')} disabled={saving}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

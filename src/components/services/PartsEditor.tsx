import { useRef, useState } from 'react'
import { Camera, ImageUp, Lock, Plus, Trash2, X } from 'lucide-react'
import type { PartDraft } from '@/services/services'
import { formatMoney } from '@/utils/format'
import { fileToCompressedDataUrl } from '@/utils/image'
import { useToast } from '@/components/ui/Toast'

function toCost(value: number | undefined | null): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Editable list of parts replaced. Rows feed the `service_parts` table. */
export function PartsEditor({
  parts,
  onChange,
  currency = '₹',
}: {
  parts: PartDraft[]
  onChange: (parts: PartDraft[]) => void
  currency?: string
}) {
  const [zoom, setZoom] = useState<string | null>(null)
  const update = (index: number, patch: Partial<PartDraft>) => {
    onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const remove = (index: number) => {
    setZoom((z) => (z && z === parts[index]?.photoDataUrl ? null : z))
    onChange(parts.filter((_, idx) => idx !== index))
  }

  const saleTotal = parts.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0), 0)

  // Margin figures only count parts that actually have a cost entered, so an
  // old part without a cost price never inflates the profit number.
  const costParts = parts.filter((p) => toCost(p.costPrice) > 0)
  const costTotal = costParts.reduce(
    (s, p) => s + toCost(p.costPrice) * (Number(p.quantity) || 1),
    0,
  )
  const profitTotal = costParts.reduce(
    (s, p) =>
      s +
      ((Number(p.unitPrice) || 0) - toCost(p.costPrice)) * (Number(p.quantity) || 1),
    0,
  )

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="field-label mb-0">Parts Replaced</label>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-[12.5px]"
          onClick={() => onChange([...parts, { name: '', quantity: 1, unitPrice: 0 }])}
        >
          <Plus size={14} /> Add part
        </button>
      </div>
      <p className="mb-2 text-[12px] text-ink-500">
        These lines appear on the customer's report and invoice. The{' '}
        <span className="inline-flex items-center gap-0.5 font-medium text-amber-700">
          <Lock size={10} /> my cost
        </span>{' '}
        price is only for you — it never goes on the customer copy.
      </p>

      {parts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-3 py-3 text-center text-[12.5px] text-ink-500">
          No parts added. Use “Add part” to itemise parts on the report and invoice.
        </p>
      ) : (
        <div className="space-y-2">
          {parts.map((p, i) => {
            const cost = toCost(p.costPrice)
            const qty = Number(p.quantity) || 1
            const rate = Number(p.unitPrice) || 0
            const showInternal = Boolean(p.name.trim())
            return (
              <div key={i} className="space-y-1.5 rounded-lg border border-ink-100 p-2.5">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    className="input col-span-12 sm:col-span-6"
                    placeholder="Part name (e.g. 12V SMPS)"
                    value={p.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                  <input
                    className="input col-span-3 sm:col-span-2"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Qty"
                    value={p.quantity}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Quantity"
                  />
                  <input
                    className="input col-span-5 sm:col-span-2"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Rate"
                    value={p.unitPrice}
                    onChange={(e) => update(i, { unitPrice: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Unit price"
                  />
                  <div className="col-span-4 flex items-center justify-between gap-1 sm:col-span-2">
                    <span className="truncate text-[13px] font-medium text-ink-800">
                      {formatMoney(qty * rate, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove part"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {showInternal && (
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="inline-flex shrink-0 items-center gap-1 font-medium text-amber-700">
                      <Lock size={10} /> My cost / unit (internal):
                    </span>
                    <div className="relative w-24">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-[12px] text-ink-400">
                        {currency}
                      </span>
                      <input
                        className="input py-1 pl-6 text-[12.5px]"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0"
                        value={p.costPrice && p.costPrice > 0 ? String(p.costPrice) : ''}
                        onChange={(e) => {
                          const raw = e.target.value
                          update(i, {
                            costPrice: raw === '' ? undefined : Math.max(0, Number(raw) || 0),
                          })
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label="My cost per unit"
                      />
                    </div>
                    {cost > 0 ? (
                      <span
                        className={`font-semibold ${
                          rate > cost ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {formatMoney((rate - cost) * qty, currency)} profit on {qty} ×{' '}
                        {formatMoney(rate - cost, currency)}
                      </span>
                    ) : (
                      <span className="text-ink-400">not counted until a cost is entered</span>
                    )}
                  </div>
                )}

                <PartPhoto
                  index={i}
                  photo={p.photoDataUrl}
                  onPicked={(dataUrl) => update(i, { photoDataUrl: dataUrl ?? undefined })}
                  onZoom={() => setZoom(p.photoDataUrl ?? null)}
                  partName={p.name}
                />
              </div>
            )
          })}
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-[12.5px] text-ink-600">
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span>
                Charged to customer:{' '}
                <span className="font-semibold text-ink-800">{formatMoney(saleTotal, currency)}</span>
              </span>
              {costParts.length > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                  <Lock size={10} />
                  Internal: you paid {formatMoney(costTotal, currency)} → profit{' '}
                  <span className={profitTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                    {formatMoney(profitTotal, currency)}
                  </span>
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-6 animate-fade-in no-print"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Part photo"
        >
          <img src={zoom} alt="Part photo" className="max-h-full max-w-full rounded-xl shadow-2xl" />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 text-ink-700 shadow hover:bg-white"
            onClick={() => setZoom(null)}
            aria-label="Close photo"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Photo of the physical part (serial plate / label). Captured with the device
 * camera or picked from files, compressed to a small JPEG data URL, and stored
 * on the part row so the owner can zoom in later to read serial numbers.
 */
function PartPhoto({
  index,
  photo,
  onPicked,
  onZoom,
  partName,
}: {
  index: number
  photo?: string
  onPicked: (dataUrl?: string) => void
  onZoom: () => void
  partName: string
}) {
  const toast = useToast()
  const captureRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onPicked(await fileToCompressedDataUrl(file))
      toast.success('Photo added', 'Snap a clear photo of the serial number for your records.')
    } catch (err) {
      toast.error('Could not add photo', err instanceof Error ? err.message : 'Try another image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {photo && (
        <button
          type="button"
          onClick={onZoom}
          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-200"
          title="View photo"
          aria-label="View part photo"
        >
          <img src={photo} alt={`Photo of ${partName || 'part'}`} className="h-full w-full object-cover" />
          <span className="absolute inset-0 hidden items-center justify-center bg-ink-950/40 text-white group-hover:flex">
            <Camera size={16} />
          </span>
        </button>
      )}

      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <button
        type="button"
        className="btn-ghost px-2 py-1 text-[12.5px]"
        disabled={busy}
        onClick={() => captureRef.current?.click()}
      >
        <Camera size={14} /> {photo ? 'Retake' : 'Photo'}
      </button>
      <button
        type="button"
        className="btn-ghost px-2 py-1 text-[12.5px]"
        disabled={busy}
        onClick={() => pickRef.current?.click()}
      >
        <ImageUp size={14} /> Upload
      </button>
      {photo && (
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-[12.5px] text-red-600 hover:bg-red-50"
          onClick={() => onPicked(undefined)}
        >
          <X size={14} /> Remove
        </button>
      )}
      {busy && <span className="text-[12px] text-ink-400">Processing…</span>}
      {!photo && !busy && (
        <span className="text-[11.5px] text-ink-400">Snap the serial number / label (optional)</span>
      )}
      <span className="sr-only">Part photo input {index + 1}</span>
    </div>
  )
}

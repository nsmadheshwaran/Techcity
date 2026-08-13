import { Plus, Trash2 } from 'lucide-react'
import type { PartDraft } from '@/services/services'
import { formatMoney } from '@/utils/format'

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
  const update = (index: number, patch: Partial<PartDraft>) => {
    onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const total = parts.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0), 0)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="field-label mb-0">Parts Replaced</label>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-[12.5px]"
          onClick={() => onChange([...parts, { name: '', quantity: 1, unitPrice: 0 }])}
        >
          <Plus size={14} /> Add part
        </button>
      </div>

      {parts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-300 px-3 py-3 text-center text-[12.5px] text-ink-500">
          No parts added. Use “Add part” to itemise parts on the report and invoice.
        </p>
      ) : (
        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
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
                  {formatMoney((Number(p.quantity) || 0) * (Number(p.unitPrice) || 0), currency)}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(parts.filter((_, idx) => idx !== i))}
                  className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove part"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          <p className="text-right text-[12.5px] text-ink-500">
            Parts total: <span className="font-semibold text-ink-800">{formatMoney(total, currency)}</span>
          </p>
        </div>
      )}
    </div>
  )
}

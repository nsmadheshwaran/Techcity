import { Lock, Plus, Trash2 } from 'lucide-react'
import type { PartDraft } from '@/services/services'
import { formatMoney } from '@/utils/format'

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
  const update = (index: number, patch: Partial<PartDraft>) => {
    onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : p)))
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
                      onClick={() => onChange(parts.filter((_, idx) => idx !== i))}
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
    </div>
  )
}

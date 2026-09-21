import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * The strip that replaces the toolbar once rows are selected. It states the
 * count in words before offering any action, because "Delete" next to a number
 * the user misread is exactly how bulk operations go wrong.
 */
export function BulkBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number
  /** Singular noun, e.g. "customer" — pluralised here. */
  noun: string
  onClear: () => void
  children: ReactNode
}) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-brand-200 bg-brand-50 px-3 py-2">
      <span className="text-[12.5px] font-bold text-brand-800">
        {count} {noun}
        {count === 1 ? '' : 's'} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <button
          onClick={onClear}
          className="btn-ghost text-brand-800 hover:bg-brand-100"
          aria-label="Clear selection"
        >
          <X size={13} /> Clear
        </button>
      </div>
    </div>
  )
}

/**
 * Tri-state select-all checkbox. `indeterminate` is a DOM property with no HTML
 * attribute, so it has to be set through a ref callback.
 */
export function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  label = 'Select all rows',
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  label?: string
}) {
  return (
    <input
      type="checkbox"
      className="h-3.5 w-3.5 cursor-pointer rounded border-ink-400 accent-brand-600"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate
      }}
      onChange={onChange}
      aria-label={label}
    />
  )
}

/** Per-row checkbox. Stops propagation so ticking a row never opens it. */
export function RowCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <input
      type="checkbox"
      className="h-3.5 w-3.5 cursor-pointer rounded border-ink-400 accent-brand-600"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
    />
  )
}

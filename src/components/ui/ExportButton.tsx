import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import type { ExportFormat } from '@/services/backup'

/**
 * A single "Export" button that offers CSV or Excel (.xlsx) instead of two
 * separate buttons crowding every list toolbar. Click opens a small menu;
 * picking a format calls `onExport(format)` and closes it.
 */
export function ExportButton({
  onExport,
  disabled,
  label = 'Export',
}: {
  onExport: (format: ExportFormat) => void
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(format: ExportFormat) {
    setOpen(false)
    onExport(format)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-secondary"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={16} /> <span className="sr-only sm:not-sr-only">{label}</span>
        <ChevronDown size={13} className="sr-only sm:not-sr-only" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-white shadow-lg animate-fade-in"
        >
          <button
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-50"
            onClick={() => pick('csv')}
          >
            <FileText size={15} className="text-ink-500" /> Export as CSV
          </button>
          <button
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-50"
            onClick={() => pick('excel')}
          >
            <FileSpreadsheet size={15} className="text-emerald-600" /> Export as Excel
          </button>
        </div>
      )}
    </div>
  )
}

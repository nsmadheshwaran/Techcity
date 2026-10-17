import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import {
  importProducts,
  previewProductImport,
  type ProductImportPreview,
} from '@/services/productImport'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Settings → Stock import, but surfaced from the Stock page itself since
 * that is where an owner actually thinks to bring a spreadsheet in.
 *
 * Two steps, like the full-backup restore: pick a file, see exactly what
 * would happen, then confirm. Nothing is written on the mere act of picking
 * a file — a wrong file or wrong column guess should never silently rewrite
 * the stock list.
 */
export function ProductImportModal({ open, onClose }: Props) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ProductImportPreview | null>(null)
  const [error, setError] = useState('')

  function reset() {
    setPreview(null)
    setFileName('')
    setError('')
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    setPreview(null)
    setFileName(file.name)
    try {
      setPreview(await previewProductImport(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onConfirm() {
    if (!preview) return
    setBusy(true)
    try {
      const result = await importProducts(preview.products)
      toast.success(
        'Stock imported',
        `${result.created} added, ${result.updated} updated.`,
      )
      reset()
      onClose()
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : 'Could not import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Import Stock"
      description="Bring in a product list from a spreadsheet (.xlsx or .csv)."
      size="md"
      footer={
        preview ? (
          <>
            <button className="btn-secondary" onClick={reset} disabled={busy}>
              Choose a different file
            </button>
            <button className="btn-primary" onClick={onConfirm} disabled={busy}>
              {busy ? 'Importing…' : `Import ${preview.products.length} product${preview.products.length === 1 ? '' : 's'}`}
            </button>
          </>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </button>
        )
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      {!preview && !error && (
        <div className="rounded-lg border border-dashed border-ink-300 px-4 py-8 text-center">
          <FileSpreadsheet size={28} className="mx-auto mb-2 text-ink-400" />
          <p className="mb-3 text-[13px] text-ink-600">
            A column named <span className="font-medium">Name</span> (or Product / Item) is
            required. Quantity, Category, Brand, Price and Location are all optional and matched
            by common column names — your own spreadsheet does not need to use the app's exact
            headings.
          </p>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={15} /> {busy ? 'Reading…' : 'Choose file'}
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {fileName && <p className="font-medium">{fileName}</p>}
            {error}
          </div>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={15} /> Try a different file
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-ink-50/60 px-3.5 py-2.5">
            <p className="text-[13px] font-medium text-ink-800">{fileName}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-600">
              <span className="font-semibold text-ink-900">{preview.products.length}</span> product
              {preview.products.length === 1 ? '' : 's'} found
              {preview.skipped > 0 && (
                <>
                  {' '}
                  · <span className="font-semibold text-amber-700">{preview.skipped}</span> row
                  {preview.skipped === 1 ? '' : 's'} skipped (no product name)
                </>
              )}
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th text-right">Qty</th>
                  <th className="table-th">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {preview.products.slice(0, 50).map((p, i) => (
                  <tr key={i}>
                    <td className="table-td">{p.name}</td>
                    <td className="table-td text-right">{p.quantity}</td>
                    <td className="table-td text-ink-500">{p.category || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.products.length > 50 && (
              <p className="border-t border-line bg-ink-50/60 px-3 py-1.5 text-[12px] text-ink-500">
                +{preview.products.length - 50} more not shown here
              </p>
            )}
          </div>

          <p className="text-[12px] text-ink-500">
            A product already in stock is matched by name and its quantity is updated to match this
            file; everything else about it changes only where this file actually has a value. A name
            not already in stock is added as new.
          </p>
        </div>
      )}
    </Modal>
  )
}

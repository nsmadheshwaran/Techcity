import { useRef, useState } from 'react'
import { Camera, ImageUp, X } from 'lucide-react'
import { fileToCompressedDataUrl } from '@/utils/image'
import { useToast } from '@/components/ui/Toast'

/**
 * Camera-or-gallery photo capture with a thumbnail, shared by anything that
 * needs to attach a photo to a record (service parts, equipment components…).
 * Compresses through fileToCompressedDataUrl before handing the data URL back,
 * so the caller never has to think about size.
 */
export function PhotoPicker({
  photo,
  onPicked,
  onZoom,
  label,
  hint = 'Snap a clear photo of the serial number / label (optional)',
}: {
  photo?: string
  onPicked: (dataUrl?: string) => void
  onZoom: () => void
  /** Used only for the thumbnail's alt text and the hidden input's accessible name. */
  label: string
  hint?: string
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
      toast.success('Photo added')
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
          aria-label={`View photo of ${label || 'item'}`}
        >
          <img src={photo} alt={`Photo of ${label || 'item'}`} className="h-full w-full object-cover" />
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
      {!photo && !busy && hint && <span className="text-[11.5px] text-ink-400">{hint}</span>}
      <span className="sr-only">Photo input for {label || 'item'}</span>
    </div>
  )
}

/** Full-screen lightbox for a PhotoPicker thumbnail. Click anywhere to close. */
export function PhotoZoomOverlay({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-6 animate-fade-in no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg shadow-2xl" />
      <button
        type="button"
        className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 text-ink-700 shadow hover:bg-white"
        onClick={onClose}
        aria-label="Close photo"
      >
        <X size={18} />
      </button>
    </div>
  )
}

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    setBusy(false)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    if (value) setBusy(true)
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
    setBusy(false)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(options)}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => settle(false)} disabled={busy}>
              {options?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              className={options?.danger ? 'btn-danger' : 'btn-primary'}
              onClick={() => settle(true)}
              disabled={busy}
              autoFocus
            >
              {options?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <div className="flex gap-3">
          {options?.danger && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={18} />
            </span>
          )}
          <div className="text-sm leading-relaxed text-ink-700">{options?.message}</div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

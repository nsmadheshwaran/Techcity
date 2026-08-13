import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++counter
      setToasts((prev) => [...prev.slice(-3), { ...t, id }])
      const ttl = t.kind === 'error' ? 7000 : 4000
      window.setTimeout(() => remove(id), ttl)
    },
    [remove],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ kind: 'success', title, description }),
      error: (title, description) => push({ kind: 'error', title, description }),
      info: (title, description) => push({ kind: 'info', title, description }),
      warning: (title, description) => push({ kind: 'warning', title, description }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end no-print">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const STYLES: Record<ToastKind, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-200', iconColor: 'text-emerald-600' },
  error: { icon: XCircle, ring: 'border-red-200', iconColor: 'text-red-600' },
  info: { icon: Info, ring: 'border-brand-200', iconColor: 'text-brand-600' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', iconColor: 'text-amber-600' },
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const { icon: Icon, ring, iconColor } = STYLES[toast.kind]
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border ${ring} bg-white px-4 py-3 shadow-lg animate-slide-up`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[13px] leading-snug text-ink-600 break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

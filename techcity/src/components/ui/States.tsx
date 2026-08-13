import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
        <Icon size={22} />
      </span>
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <AlertTriangle size={20} />
      </span>
      <h3 className="text-[15px] font-semibold text-ink-900">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-ink-600">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-ink-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-3.5 flex-1 animate-pulse rounded bg-ink-100"
              style={{ maxWidth: c === 0 ? '30%' : '20%' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

import { useSettings } from '@/hooks/useData'

/** Business logo — uses the uploaded logo when set, otherwise the built-in mark. */
export function BrandMark({ size = 36 }: { size?: number }) {
  const settings = useSettings()
  if (settings.logoDataUrl) {
    return (
      <img
        src={settings.logoDataUrl}
        alt={settings.name}
        width={size}
        height={size}
        className="rounded-lg object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#1a37b5" />
      <rect x="14" y="21" width="30" height="19" rx="2.5" fill="#ffffff" />
      <rect x="17.5" y="24.5" width="23" height="12" rx="1.5" fill="#1a37b5" />
      <path d="M20 28.5h9M20 32h14" stroke="#8eb6ff" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="10" y="43" width="38" height="3.6" rx="1.8" fill="#ffffff" />
      <circle cx="49.5" cy="19.5" r="7.5" fill="#f59e0b" />
      <circle cx="49.5" cy="19.5" r="3.2" fill="#141d45" />
      <circle cx="48.4" cy="18.3" r="1.1" fill="#ffffff" />
    </svg>
  )
}

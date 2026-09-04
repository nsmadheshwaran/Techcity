import { useSettings } from '@/hooks/useData'
import logoDefault from '@/assets/logo-tc.jpg?inline'

/** Business logo — uses the uploaded logo when set, otherwise the built-in TC mark. */
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
    <img
      src={logoDefault}
      alt={settings.name}
      width={size}
      height={size}
      className="rounded-lg object-contain bg-white"
      style={{ width: size, height: size }}
    />
  )
}

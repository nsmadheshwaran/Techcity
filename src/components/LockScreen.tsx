import { useState, type FormEvent } from 'react'
import { Lock, LogIn } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useSettings } from '@/hooks/useData'
import { BrandMark } from './BrandMark'

export function LockScreen() {
  const { unlock, username } = useAuth()
  const settings = useSettings()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlock(passcode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock')
      setPasscode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={52} />
          <h1 className="mt-4 text-lg font-bold tracking-tight text-ink-900">{settings.name}</h1>
          <p className="mt-1 text-[13px] text-ink-500">{settings.tagline}</p>
        </div>
        <form onSubmit={onSubmit} className="card p-6">
          <div className="mb-4 flex items-center gap-2 text-ink-700">
            <Lock size={16} className="text-brand-600" />
            <p className="text-sm font-semibold">Enter passcode to continue</p>
          </div>
          <p className="mb-4 text-[13px] text-ink-500">
            Signed in as <span className="font-medium text-ink-800">{username}</span>. Customer
            records are protected on this device.
          </p>
          <input
            type="password"
            className={`input ${error ? 'input-error' : ''}`}
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="mt-2 text-[12px] font-medium text-red-600">{error}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || !passcode}>
            <LogIn size={16} /> {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-500">
          Forgot the passcode? Clear this site's data in your browser settings — note that this also
          deletes local records, so keep regular backups from Settings → Backup.
        </p>
      </div>
    </div>
  )
}

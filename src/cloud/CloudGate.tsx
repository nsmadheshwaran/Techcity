import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CheckCircle2, Cloud, Loader2, LogIn, LogOut, RefreshCw, UserPlus, XCircle } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { cloudEnabled, supabase } from '@/lib/cloud'
import { installSyncHooks, syncNow, type SyncResult } from '@/services/sync'
import { formatDate } from '@/utils/format'

interface CloudState {
  enabled: boolean
  /** Email of the signed-in owner (null until a session exists). */
  userEmail: string | null
  booted: boolean
  syncing: boolean
  lastSyncAt: number | null
  syncError: string | null
  login: (email: string, password: string, create: boolean) => Promise<string | null>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const CloudContext = createContext<CloudState | null>(null)

export function useCloud(): CloudState {
  const ctx = useContext(CloudContext)
  if (!ctx) throw new Error('useCloud must be used inside CloudProvider')
  return ctx
}

const SYNC_INTERVAL_MS = 45_000

export function CloudProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [booted, setBooted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const mounted = useMounted()

  // One quiet sync — sets status but never blocks the UI.
  const refresh = useCallback(async () => {
    if (!cloudEnabled || !supabase) return
    const userId = supabase.auth.getUser()
    const { data } = await userId
    if (!data.user) return
    setSyncing(true)
    const result: SyncResult = await syncNow(data.user.id)
    if (!mounted.current) return
    setSyncing(false)
    setLastSyncAt(result.at)
    if (result.ok) setSyncError(null)
    else if (result.error && result.error !== 'A sync is already running.') setSyncError(result.error)
  }, [mounted])

  // Session bootstrap + auto-sync while the owner has the app open.
  useEffect(() => {
    if (!cloudEnabled || !supabase) {
      setBooted(true)
      return
    }
    installSyncHooks()
    let unsubscribe: (() => void) | undefined

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted.current) return
        setUserEmail(data.session?.user.email ?? null)

        setBooted(true)
        if (data.session?.user) void refresh()
      })
      .catch(() => {
        if (mounted.current) setBooted(true)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
      if (session?.user) void refresh()
    })
    unsubscribe = sub.subscription.unsubscribe
    return () => unsubscribe?.()
  }, [refresh, mounted])

  // Periodic + on-focus refresh so the other device's changes appear.
  useEffect(() => {
    if (!cloudEnabled || !supabase || !userEmail) return
    const timer = setInterval(() => void refresh(), SYNC_INTERVAL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [userEmail, refresh])

  const login = useCallback(
    async (email: string, password: string, create: boolean): Promise<string | null> => {
      if (!cloudEnabled || !supabase) return 'Cloud sync is not configured on this build.'
      try {
        const res = create
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password })
        if (res.error) return res.error.message
        if (create && !res.data.session) {
          return 'Account created — check the inbox for a confirmation link, then log in.'
        }
        return null
      } catch (err) {
        return err instanceof Error ? err.message : 'Could not connect. Check your internet.'
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUserEmail(null)
    setSyncError(null)
    setLastSyncAt(null)
  }, [])

  const value = useMemo<CloudState>(
    () => ({
      enabled: cloudEnabled,
      userEmail,
      booted,
      syncing,
      lastSyncAt,
      syncError,
      login,
      logout,
      refresh,
    }),
    [userEmail, booted, syncing, lastSyncAt, syncError, login, logout, refresh],
  )

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>
}

function useMounted() {
  const ref = useRef(true)
  useEffect(() => {
    ref.current = true
    return () => {
      ref.current = false
    }
  }, [])
  return ref
}

/** Full-screen owner sign-in — shown only when cloud sync is enabled. */
export function CloudLogin() {
  const { login } = useCloud()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [create, setCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setMessage({ kind: 'error', text: 'Enter your email and password.' })
      return
    }
    setBusy(true)
    setMessage(null)
    const err = await login(email.trim(), password, create)
    if (err) setMessage({ kind: create ? 'info' : 'error', text: err })
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={52} />
          <h1 className="mt-4 text-lg font-bold tracking-tight text-ink-900">TECH CITY</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Owner sign-in — your records are shared between your phone and computer.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card p-6">
          <div className="mb-4 flex items-center gap-2 text-ink-700">
            <Cloud size={16} className="text-brand-600" />
            <p className="text-sm font-semibold">
              {create ? 'Create the owner account' : 'Log in to sync'}
            </p>
          </div>
          {message && (
            <div
              className={`mb-4 rounded-lg border px-3 py-2 text-[13px] ${
                message.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {message.text}
            </div>
          )}
          <div className="space-y-3">
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              type="password"
              autoComplete={create ? 'new-password' : 'current-password'}
              placeholder={create ? 'Choose a password (min 6 characters)' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary mt-4 w-full" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : create ? (
              <UserPlus size={16} />
            ) : (
              <LogIn size={16} />
            )}
            {create ? 'Create account' : 'Log in'}
          </button>
          <button
            type="button"
            className="mt-2 w-full text-center text-[12.5px] font-medium text-brand-700 hover:underline"
            onClick={() => {
              setCreate((c) => !c)
              setMessage(null)
            }}
          >
            {create ? 'Already have an account? Log in' : 'First time? Create the owner account'}
          </button>
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
            If you created the account in the Supabase dashboard instead, just log in with those
            details.
          </p>
        </form>
      </div>
    </div>
  )
}

/** Settings card showing connection + sync status (cloud builds only). */
export function CloudStatusCard() {
  const cloud = useCloud()
  if (!cloud.enabled) return null
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-ink-900">
        <Cloud size={16} className="text-brand-600" /> Cloud Sync
      </h2>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-500">
        Your records are automatically kept in sync between every device where you log in with the
        same owner account.
      </p>
      {cloud.userEmail ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-[13px]">
            {cloud.syncing ? (
              <>
                <Loader2 size={15} className="animate-spin text-brand-600" />
                <span className="text-ink-600">Syncing your data…</span>
              </>
            ) : cloud.syncError ? (
              <>
                <XCircle size={15} className="text-red-600" />
                <span className="text-ink-700">
                  Last sync failed: <span className="text-red-700">{cloud.syncError}</span>
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span className="text-ink-700">
                  Synced
                  {cloud.lastSyncAt
                    ? ` · ${formatDate(new Date(cloud.lastSyncAt).toISOString())}`
                    : ' just now'}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={cloud.syncing}
              onClick={() => void cloud.refresh()}
            >
              <RefreshCw size={15} className={cloud.syncing ? 'animate-spin' : ''} /> Sync now
            </button>
            <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => void cloud.logout()}>
              <LogOut size={15} /> Log out
            </button>
          </div>
          <p className="text-[12px] text-ink-500">Logged in as {cloud.userEmail}</p>
        </div>
      ) : (
        <p className="text-[13px] text-ink-500">
          Not signed in. The login screen appears when you open the app — or use the passcode lock
          on this device.
        </p>
      )}
    </section>
  )
}

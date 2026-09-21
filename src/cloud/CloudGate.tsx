import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  CheckCircle2,
  Cloud,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { cloudEnabled, supabase } from '@/lib/cloud'
import { installSyncHooks, syncNow, type SyncResult } from '@/services/sync'
import { formatDate } from '@/utils/format'
import { CloudContext, useCloud, type CloudState } from './CloudContext'
export type { CloudState }

const SYNC_INTERVAL_MS = 45_000

export function CloudProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [booted, setBooted] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [offlineMode, setOfflineModeState] = useState<boolean>(() => {
    return localStorage.getItem('techcity_offline_mode') === 'true'
  })
  const mounted = useMounted()

  const setOfflineMode = useCallback((val: boolean) => {
    setOfflineModeState(val)
    if (val) {
      localStorage.setItem('techcity_offline_mode', 'true')
    } else {
      localStorage.removeItem('techcity_offline_mode')
    }
  }, [])

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
      if (session?.user) {
        setOfflineModeState(false)
        localStorage.removeItem('techcity_offline_mode')
        void refresh()
      }
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
        setOfflineModeState(false)
        localStorage.removeItem('techcity_offline_mode')
        setLoginModalOpen(false)
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
      offlineMode,
      setOfflineMode,
      loginModalOpen,
      setLoginModalOpen,
      login,
      logout,
      refresh,
    }),
    [
      userEmail,
      booted,
      syncing,
      lastSyncAt,
      syncError,
      offlineMode,
      setOfflineMode,
      loginModalOpen,
      login,
      logout,
      refresh,
    ],
  )

  return (
    <CloudContext.Provider value={value}>
      {children}
      {loginModalOpen && <CloudLoginModal onClose={() => setLoginModalOpen(false)} />}
    </CloudContext.Provider>
  )
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

interface CloudLoginProps {
  onContinueOffline?: () => void
  isModal?: boolean
}

/** Owner sign-in form — works both full-screen and inside a modal dialog. */
export function CloudLogin({ onContinueOffline, isModal = false }: CloudLoginProps) {
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

  const content = (
    <div className="w-full max-w-sm">
      {!isModal && (
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={52} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-ink-900">TECH CITY</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Owner sign-in — your records sync automatically across phone and counter PC.
          </p>
        </div>
      )}
      <form onSubmit={onSubmit} className="card p-6 shadow-xl border border-ink-200/80">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Cloud size={16} />
            </span>
            <p className="text-sm font-semibold">
              {create ? 'Create Owner Account' : 'Log In to Sync'}
            </p>
          </div>
          {isModal && onContinueOffline && (
            <button
              type="button"
              onClick={onContinueOffline}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
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
          <div>
            <label className="field-label">Email address</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="owner@techcity.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete={create ? 'new-password' : 'current-password'}
              placeholder={create ? 'Minimum 6 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-primary mt-5 w-full py-2.5 shadow-md" disabled={busy}>
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
          className="mt-2.5 w-full text-center text-[12.5px] font-medium text-brand-700 hover:underline"
          onClick={() => {
            setCreate((c) => !c)
            setMessage(null)
          }}
        >
          {create ? 'Already have an account? Log in' : 'First time? Create the owner account'}
        </button>

        {onContinueOffline && (
          <>
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink-200" />
              </div>
              <span className="relative bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">
                or
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary w-full py-2 text-xs font-semibold text-ink-700 hover:text-ink-900"
              onClick={onContinueOffline}
            >
              Continue in Local / Offline Mode
            </button>
          </>
        )}

        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
          Data is always saved locally on this device. Connecting Supabase allows seamless
          two-way sync with your mobile phone.
        </p>
      </form>
    </div>
  )

  if (isModal) return content

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-ink-100 via-ink-100 to-brand-50/40 px-4 py-10">
      {content}
    </div>
  )
}

/** Modal dialog wrapper for CloudLogin. */
export function CloudLoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        <CloudLogin isModal onContinueOffline={onClose} />
      </div>
    </div>
  )
}

/** Header pill showing live cloud sync status with click-to-sync / sign-in. */
export function CloudSyncPill() {
  const cloud = useCloud()
  if (!cloud.enabled) return null

  if (cloud.userEmail) {
    return (
      <button
        onClick={() => void cloud.refresh()}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
          cloud.syncing
            ? 'border-brand-300 bg-brand-50 text-brand-700 animate-pulse'
            : cloud.syncError
            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
        }`}
        title={
          cloud.syncing
            ? 'Syncing with Supabase…'
            : cloud.syncError
            ? `Sync error: ${cloud.syncError}. Click to retry.`
            : `Connected as ${cloud.userEmail}. Click to sync now.`
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            cloud.syncing
              ? 'bg-brand-500 animate-ping'
              : cloud.syncError
              ? 'bg-red-500'
              : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
          }`}
        />
        <span className="hidden sm:inline">
          {cloud.syncing ? 'Syncing…' : cloud.syncError ? 'Sync issue' : 'Synced'}
        </span>
        <Cloud size={12} className="opacity-75" />
      </button>
    )
  }

  return (
    <button
      onClick={() => cloud.setLoginModalOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 bg-white px-2.5 py-1 text-xs font-medium text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      title="Running locally on this device. Click to sign in to Supabase for multi-device sync."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
      <span className="hidden sm:inline">Local Mode</span>
      <Cloud size={12} className="text-ink-400" />
    </button>
  )
}

/** Settings card showing connection + sync status (cloud builds only). */
export function CloudStatusCard() {
  const cloud = useCloud()
  if (!cloud.enabled) return null

  return (
    <section className="card p-4 sm:p-5 border border-ink-200/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-ink-100 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Cloud size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900 leading-tight">Supabase Cloud Sync</h2>
            <p className="text-[11.5px] text-ink-500">Multi-device real-time backup and sync</p>
          </div>
        </div>
        {cloud.userEmail ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-600">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
            Local Only
          </span>
        )}
      </div>

      <p className="mb-4 text-[13px] leading-relaxed text-ink-600">
        Your records are automatically synchronized between your counter computer and your mobile
        device whenever connected.
      </p>

      {cloud.userEmail ? (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between rounded-lg bg-ink-50 p-3 text-[13px] border border-ink-100">
            <div className="flex items-center gap-2">
              {cloud.syncing ? (
                <>
                  <Loader2 size={16} className="animate-spin text-brand-600" />
                  <span className="font-medium text-ink-700">Syncing changes with cloud…</span>
                </>
              ) : cloud.syncError ? (
                <>
                  <XCircle size={16} className="text-red-600" />
                  <span className="text-red-700 font-medium">Sync issue: {cloud.syncError}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-ink-700 font-medium">
                    All data up to date
                    {cloud.lastSyncAt ? ` · ${formatDate(new Date(cloud.lastSyncAt).toISOString())}` : ''}
                  </span>
                </>
              )}
            </div>
            <p className="text-[12px] font-medium text-ink-500 truncate max-w-[180px] sm:max-w-none">
              {cloud.userEmail}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              className="btn-primary"
              disabled={cloud.syncing}
              onClick={() => void cloud.refresh()}
            >
              <RefreshCw size={15} className={cloud.syncing ? 'animate-spin' : ''} /> Sync Now
            </button>
            <button
              className="btn-secondary text-red-600 hover:bg-red-50 hover:border-red-200"
              onClick={() => void cloud.logout()}
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50/60 p-4 text-center">
          <p className="text-[13px] font-medium text-ink-800">
            Working in offline local storage mode
          </p>
          <p className="mt-1 text-[12px] text-ink-500">
            Sign in with your Tech City Supabase owner account to enable real-time sync across devices.
          </p>
          <button
            onClick={() => cloud.setLoginModalOpen(true)}
            className="btn-primary mt-3 text-xs"
          >
            <LogIn size={14} /> Connect Supabase Account
          </button>
        </div>
      )}
    </section>
  )
}

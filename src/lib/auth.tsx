import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { db, nowISO } from '@/lib/db'

/**
 * Local passcode lock.
 *
 * This build stores all data locally in the browser (IndexedDB), so there is no
 * server to authenticate against. To still keep customer records private on a
 * shared shop computer, the app supports an owner passcode: the SHA-256 hash is
 * stored (never the passcode itself) and the session is remembered in sessionStorage.
 *
 * If you switch to Supabase (see supabase/schema.sql + README) replace this
 * provider with Supabase Auth — the rest of the app only uses `useAuth()`.
 */

const SESSION_KEY = 'techcity.session'

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface AuthValue {
  ready: boolean
  /** true when a passcode has been configured */
  enabled: boolean
  unlocked: boolean
  username: string
  unlock: (passcode: string) => Promise<void>
  lock: () => void
  setPasscode: (current: string | null, next: string, username?: string) => Promise<void>
  disableLock: (current: string) => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [username, setUsername] = useState('Owner')

  const refresh = useCallback(async () => {
    const user = await db.users.get('owner')
    setEnabled(Boolean(user?.passHash))
    setUsername(user?.username || 'Owner')
    if (!user?.passHash) {
      setUnlocked(true)
    } else {
      setUnlocked(sessionStorage.getItem(SESSION_KEY) === user.passHash.slice(0, 16))
    }
    setReady(true)
  }, [])

  useEffect(() => {
    refresh().catch(() => setReady(true))
  }, [refresh])

  const unlock = useCallback(async (passcode: string) => {
    const user = await db.users.get('owner')
    if (!user?.passHash) return
    const hash = await sha256(passcode)
    if (hash !== user.passHash) throw new Error('Incorrect passcode. Please try again.')
    sessionStorage.setItem(SESSION_KEY, hash.slice(0, 16))
    setUnlocked(true)
  }, [])

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setUnlocked(false)
  }, [])

  const setPasscode = useCallback(
    async (current: string | null, next: string, name?: string) => {
      if (next.length < 4) throw new Error('Passcode must be at least 4 characters.')
      const user = await db.users.get('owner')
      if (user?.passHash) {
        if (!current) throw new Error('Enter your current passcode.')
        const currentHash = await sha256(current)
        if (currentHash !== user.passHash) throw new Error('Current passcode is incorrect.')
      }
      const hash = await sha256(next)
      await db.users.put({
        id: 'owner',
        username: name || user?.username || 'Owner',
        passHash: hash,
        createdAt: user?.createdAt ?? nowISO(),
      })
      sessionStorage.setItem(SESSION_KEY, hash.slice(0, 16))
      await refresh()
      setUnlocked(true)
    },
    [refresh],
  )

  const disableLock = useCallback(
    async (current: string) => {
      const user = await db.users.get('owner')
      if (!user?.passHash) return
      const hash = await sha256(current)
      if (hash !== user.passHash) throw new Error('Current passcode is incorrect.')
      await db.users.delete('owner')
      sessionStorage.removeItem(SESSION_KEY)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<AuthValue>(
    () => ({ ready, enabled, unlocked, username, unlock, lock, setPasscode, disableLock }),
    [ready, enabled, unlocked, username, unlock, lock, setPasscode, disableLock],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

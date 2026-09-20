import { createContext, useContext } from 'react'

export interface CloudState {
  enabled: boolean
  /** Email of the signed-in owner (null until a session exists). */
  userEmail: string | null
  booted: boolean
  syncing: boolean
  lastSyncAt: number | null
  syncError: string | null
  offlineMode: boolean
  setOfflineMode: (v: boolean) => void
  loginModalOpen: boolean
  setLoginModalOpen: (v: boolean) => void
  login: (email: string, password: string, create: boolean) => Promise<string | null>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const CloudContext = createContext<CloudState | null>(null)

export function useCloud(): CloudState {
  const ctx = useContext(CloudContext)
  if (!ctx) throw new Error('useCloud must be used inside CloudProvider')
  return ctx
}

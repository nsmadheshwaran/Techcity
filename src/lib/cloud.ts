import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Optional Supabase backend for multi-device sync (father's phone + computer).
 * The app is fully local-first: when no URL/key are configured nothing here
 * is created and every screen behaves exactly as before.
 *
 * Find the URL and anon key at: Supabase Dashboard → Project Settings → API.
 * The anon key is safe in the browser ONLY because supabase/schema.sql enables
 * Row Level Security on every table (each row belongs to the signed-in owner).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null =
  cloudEnabled && url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null

/** Tables shared between the local IndexedDB store and the cloud. */
export const SYNC_TABLES: { local: string; cloud: string }[] = [
  { local: 'customers', cloud: 'customers' },
  { local: 'customerContacts', cloud: 'customer_contacts' },
  { local: 'services', cloud: 'services' },
  { local: 'serviceParts', cloud: 'service_parts' },
  { local: 'payments', cloud: 'payments' },
  { local: 'equipment', cloud: 'equipment' },
  { local: 'reminders', cloud: 'reminders' },
  { local: 'calls', cloud: 'calls' },
  { local: 'quotations', cloud: 'quotations' },
]

/** Local table names (also used for counters + settings handling). */
export const SYNC_LOCAL_NAMES = SYNC_TABLES.map((t) => t.local)

export function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())
}

/** camelCase local row → snake_case cloud row, dropping unset fields. */
export function toCloudRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === null) continue
    out[camelToSnake(key)] = val
  }
  return out
}

/** snake_case cloud row → camelCase local row, normalising dates to ISO strings. */
export function toLocalRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(row)) {
    if (key === 'owner_id') continue
    if (val instanceof Date) out[snakeToCamel(key)] = val.toISOString()
    else out[snakeToCamel(key)] = val
  }
  return out
}



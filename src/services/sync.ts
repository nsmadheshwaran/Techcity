import { db, nowISO, type SyncOutboxRow } from '@/lib/db'
import {
  cloudEnabled,
  supabase,
  SYNC_TABLES,
  toCloudRow,
  toLocalRow,
} from '@/lib/cloud'

/**
 * Optional Supabase sync for multi-device use.
 *
 * Model: the local IndexedDB store is the working cache. Every successful
 * sync 1) pushes journaled deletes, 2) upserts the full local dataset, then
 * 3) pulls the cloud dataset and replaces the local store with it (cloud is
 * authoritative). Because the owner is a single person who works on one
 * device at a time, "last device to sync wins" is a safe trade-off and keeps
 * the engine simple. No cloud is configured → this module is inert.
 */

const UPLOAD_CHUNK = 150

let hooksInstalled = false
let suppressJournal = false
let running = false

/** Installs deletion journaling so row deletes reach the cloud on next sync. */
export function installSyncHooks() {
  if (hooksInstalled || !cloudEnabled || !supabase) return
  hooksInstalled = true
  for (const { local } of SYNC_TABLES) {
    db.table(local).hook('deleting', (_rowId: unknown) => {
      // Only journal user deletions — never the internal replace during a pull.
      if (suppressJournal) return
      const rowId = String(_rowId)
      const table = local
      // Run after the current transaction commits so the journal write can use
      // its own transaction (the deleting txn may not include the outbox store).
      setTimeout(() => {
        void db.outbox.add({ table, rowId, at: nowISO() } satisfies SyncOutboxRow)
      }, 0)
    })
  }
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

async function flushOutbox(): Promise<number> {
  const entries = await db.outbox.orderBy('at').toArray()
  if (!entries.length) return 0
  for (const e of entries) {
    const cloud = SYNC_TABLES.find((t) => t.local === e.table)?.cloud
    if (!cloud) continue
    const { error } = await supabase!.from(cloud).delete().eq('id', e.rowId)
    if (error) throw new Error(`Could not delete ${e.table} row in cloud: ${error.message}`)
  }
  await db.outbox.clear()
  return entries.length
}

/** Upserts every local row of one table into the cloud (parents first). */
async function pushTable(local: string, cloud: string) {
  const rows = await db.table(local).toArray()
  if (!rows.length) return
  const payload = rows.map((r) => toCloudRow(r as Record<string, unknown>))
  for (const part of chunk(payload, UPLOAD_CHUNK)) {
    const { error } = await supabase!.from(cloud).upsert(part, { onConflict: 'id' })
    if (error) throw new Error(`${cloud}: ${error.message}`)
  }
}

async function pushCounters(userId: string) {
  const rows = await db.counters.toArray()
  if (!rows.length) return
  const payload = rows.map((c) => ({
    owner_id: userId,
    key: c.key,
    value: c.value,
    updated_at: nowISO(),
  }))
  for (const part of chunk(payload, UPLOAD_CHUNK)) {
    const { error } = await supabase!.from('counters').upsert(part, {
      onConflict: 'owner_id,key',
    })
    if (error) throw new Error(`counters: ${error.message}`)
  }
}

/** Postgres text[] literal — supabase-js sends plain arrays as JSON which text[] rejects. */
function pgArray(values: string[]): string {
  const escaped = values.map((v) => `"${v.replace(/"/g, '\\"')}"`)
  return `{${escaped.join(',')}}`
}

async function pushSettings(userId: string) {
  const s = (await db.settings.get('business')) as
    | Record<string, unknown>
    | undefined
  if (!s) return
  const { id: _id, ...rest } = s
  const snake = toCloudRow(rest)
  const payload = {
    owner_id: userId,
    ...snake,
    service_types: Array.isArray(s.serviceTypes) ? pgArray(s.serviceTypes as string[]) : undefined,
    updated_at: nowISO(),
  }
  const { error } = await supabase!.from('business_settings').upsert(payload, {
    onConflict: 'owner_id',
  })
  if (error) throw new Error(`business_settings: ${error.message}`)
}

/** Pulls cloud data for every synced table plus settings + counters. */
async function pullCloudData(): Promise<{
  tables: Record<string, Record<string, unknown>[]>
  counters: Record<string, unknown>[]
  settings: Record<string, unknown> | null
}> {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const { local, cloud } of SYNC_TABLES) {
    const { data, error } = await supabase!.from(cloud).select('*')
    if (error) throw new Error(`${cloud}: ${error.message}`)
    tables[local] = (data ?? []).map((r) => toLocalRow(r as Record<string, unknown>))
  }
  const { data: counters, error: countersError } = await supabase!
    .from('counters')
    .select('*')
  if (countersError) throw new Error(`counters: ${countersError.message}`)
  const { data: settings, error: settingsError } = await supabase!
    .from('business_settings')
    .select('*')
    .maybeSingle()
  if (settingsError) throw new Error(`business_settings: ${settingsError.message}`)
  return {
    tables,
    counters: (counters ?? []).map((r) => toLocalRow(r as Record<string, unknown>)),
    settings: settings ? (toLocalRow(settings as Record<string, unknown>) as Record<string, unknown>) : null,
  }
}

/** Atomically replaces the local store with freshly pulled cloud data. */
async function applyRemote(data: Awaited<ReturnType<typeof pullCloudData>>) {
  suppressJournal = true
  try {
    await db.transaction(
      'rw',
      [db.settings, db.counters, ...SYNC_TABLES.map((t) => db.table(t.local))],
      async () => {
        for (const { local } of SYNC_TABLES) {
          const rows = data.tables[local] ?? []
          const tbl = db.table(local)
          await tbl.clear()
          if (rows.length) await tbl.bulkAdd(rows)
        }
        await db.counters.clear()
        const counterRows = data.counters
          .filter((c) => c.key !== undefined)
          .map((c) => ({ key: String(c.key), value: Number(c.value) || 0 }))
        if (counterRows.length) await db.counters.bulkAdd(counterRows)

        if (data.settings) {
          await db.settings.put({ id: 'business', ...data.settings } as never)
        }
      },
    )
  } finally {
    suppressJournal = false
  }
}

export interface SyncResult {
  ok: boolean
  error?: string
  at: number
}

/**
 * One full sync cycle. Returns { ok } — never throws, so the UI can show the
 * outcome without crashing. Safe to call repeatedly; concurrent calls queue.
 */
export async function syncNow(userId: string): Promise<SyncResult> {
  const at = Date.now()
  if (!cloudEnabled || !supabase) return { ok: false, error: 'Cloud sync is not configured.', at }
  if (running) return { ok: false, error: 'A sync is already running.', at }
  running = true
  try {
    await flushOutbox()
    // Parents before children so foreign keys always resolve.
    const ordered = [...SYNC_TABLES].sort((a, b) => {
      const rank = (name: string) =>
        name === 'customers' ? 0 : name === 'customerContacts' ? 1 : name === 'services' ? 2 : 3
      return rank(a.cloud) - rank(b.cloud)
    })
    for (const { local, cloud } of ordered) await pushTable(local, cloud)
    await pushCounters(userId)
    await pushSettings(userId)
    const pulled = await pullCloudData()
    await applyRemote(pulled)
    return { ok: true, at }
  } catch (err) {
    return {
      ok: false,
      at,
      error: err instanceof Error ? err.message : 'Cloud sync failed.',
    }
  } finally {
    running = false
  }
}

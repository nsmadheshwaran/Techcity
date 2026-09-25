import { db, nowISO, type SyncOutboxRow } from '@/lib/db'
import {
  cloudEnabled,
  groupByColumns,
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

export function setSuppressJournal(val: boolean) {
  suppressJournal = val
}

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

/**
 * Human-readable codes are generated from a LOCAL counter, so two devices
 * working offline both mint TC-CUS-00032. Whichever syncs second hits the
 * unique index on `code` with a different id, and its record used to be
 * dropped on the floor — then deleted locally by the pull that followed.
 *
 * Re-code the local row instead: take a number above everything either side
 * has used, write it back locally, and let it upload cleanly. Nothing is lost
 * and the collision cannot repeat, because the counter is advanced too.
 */
const CODE_TABLES: Record<string, { prefix: string; counter: string }> = {
  customers: { prefix: 'TC-CUS-', counter: 'customer' },
  services: { prefix: 'TC-SRV-', counter: 'service' },
  equipment: { prefix: 'TC-EQP-', counter: 'equipment' },
  quotations: { prefix: 'TC-QTN-', counter: 'quotation' },
}

/**
 * Pure half of reconcileCodes: decides which local rows need a new code.
 *
 * A row keeps its code when the cloud has never seen it, or when the cloud row
 * holding it IS this row. It is only reassigned when a DIFFERENT id already
 * owns that code. New numbers start above the highest either side has used, so
 * a reassignment can never collide with an existing record or with another
 * reassignment in the same pass.
 */
export function planCodeReassignments(
  mine: { id: string; code: string }[],
  ownerOfCode: Map<string, string>,
  prefix: string,
): { changes: { id: string; code: string }[]; highest: number } {
  const numberOf = (code: string) => {
    const n = Number(code.slice(prefix.length))
    return Number.isFinite(n) ? n : 0
  }
  let highest = 0
  for (const c of ownerOfCode.keys()) highest = Math.max(highest, numberOf(c))
  for (const r of mine) highest = Math.max(highest, numberOf(r.code))

  const changes: { id: string; code: string }[] = []
  for (const row of mine) {
    const holder = ownerOfCode.get(row.code)
    if (!holder || holder === row.id) continue
    highest += 1
    changes.push({ id: row.id, code: prefix + String(highest).padStart(5, '0') })
  }
  return { changes, highest }
}

async function reconcileCodes(local: string, cloud: string): Promise<number> {
  const conf = CODE_TABLES[cloud]
  if (!conf) return 0

  const rows = (await db.table(local).toArray()) as Record<string, unknown>[]
  const mine = rows.filter((r) => !r.isDemo && typeof r.code === 'string')
  if (!mine.length) return 0

  const { data, error } = await supabase!.from(cloud).select('id, code')
  if (error) throw new Error(`${cloud}: ${error.message}`)

  const ownerOfCode = new Map<string, string>()
  for (const r of data ?? []) ownerOfCode.set(String(r.code), String(r.id))

  const { changes, highest } = planCodeReassignments(
    mine.map((r) => ({ id: String(r.id), code: r.code as string })),
    ownerOfCode,
    conf.prefix,
  )

  for (const change of changes) {
    await db.table(local).update(change.id, { code: change.code, updatedAt: nowISO() })
  }
  const renamed = changes.length

  if (renamed) {
    const current = await db.counters.get(conf.counter)
    if (!current || current.value < highest) {
      await db.counters.put({ key: conf.counter, value: highest })
    }
  }
  return renamed
}

/** A row the cloud refused for a reason the owner has to resolve. */
interface PushFailure {
  table: string
  label: string
  reason: string
}

/** Upserts every local row of one table into the cloud (parents first). */
async function pushTable(local: string, cloud: string, failures: PushFailure[]) {
  const rows = await db.table(local).toArray()
  if (!rows.length) return
  // Filter out demo rows (isDemo: true) so sample/demo data is never uploaded to the cloud
  // or causes code unique constraint collisions with real cloud records.
  const realRows = rows.filter((r) => !(r as Record<string, unknown>).isDemo)
  if (!realRows.length) return

  const payload = realRows.map((r) => toCloudRow(r as Record<string, unknown>))
  // One request per distinct column signature: a column must never be present
  // for some rows and absent for others, or PostgREST pads the gaps with NULL
  // and NOT NULL columns reject the whole batch. See groupByColumns().
  for (const group of groupByColumns(payload)) {
    for (const part of chunk(group, UPLOAD_CHUNK)) {
      const { error } = await supabase!.from(cloud).upsert(part, { onConflict: 'id' })
      if (!error) continue

      const conflict = /duplicate key|unique constraint/i.test(error.message)
      if (!conflict) throw new Error(`${cloud}: ${error.message}`)

      // A whole batch fails because of one bad row, so retry individually:
      // 149 good records should not be held back by the 150th. Anything still
      // refused is reported rather than discarded — silently skipping a row
      // here is what previously let the following pull delete it locally.
      for (const row of part) {
        const { error: rowError } = await supabase!
          .from(cloud)
          .upsert([row], { onConflict: 'id' })
        if (!rowError) continue
        console.warn(`[Sync] ${cloud} rejected a row:`, rowError.message)
        failures.push({
          table: cloud,
          label: String(row.code ?? row.name ?? row.id ?? 'record'),
          reason: rowError.message,
        })
      }
    }
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

    // Settle code collisions with the cloud BEFORE uploading anything. A
    // customer rejected here would take its services down with it on the next
    // step, as a foreign key violation — which is the error that kept coming
    // back every cycle.
    for (const { local, cloud } of ordered) await reconcileCodes(local, cloud)

    const failures: PushFailure[] = []
    for (const { local, cloud } of ordered) await pushTable(local, cloud, failures)
    await pushCounters(userId)
    await pushSettings(userId)

    if (failures.length) {
      // Stop short of the pull on purpose. applyRemote() replaces the local
      // store with the cloud's copy, so pulling now would delete exactly the
      // records that just failed to upload. Leaving local untouched keeps them
      // safe until the conflict is resolved.
      const shown = failures.slice(0, 3).map((f) => `${f.label} (${f.reason})`)
      const more = failures.length > shown.length ? ` +${failures.length - shown.length} more` : ''
      return {
        ok: false,
        at,
        error:
          `${failures.length} record(s) could not be uploaded, so nothing was ` +
          `downloaded either — your local data is untouched. ${shown.join('; ')}${more}`,
      }
    }

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

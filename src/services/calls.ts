import { db, nowISO, uid } from '@/lib/db'
import type { Call, CallPriority, CallSource, CallStatus } from '@/types'
import { todayISO } from '@/utils/format'

export type CallDraft = Omit<Call, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Call, 'isDemo'>>

export interface CallInput {
  date?: string
  source?: CallSource
  status?: CallStatus
  customerId?: string
  name?: string
  phone?: string
  contactPerson?: string
  issue?: string
  priority?: CallPriority
  appointmentDate?: string
  notes?: string
}

/** Marker stored on the follow-up reminder so it can be found and replaced. */
const markerFor = (callId: string) => `call:${callId}`

/** Deletes the call's follow-up reminder. `notes` is not an indexed key path on
 * the reminders store, so scan-and-delete (small table, safe for one owner). */
async function deleteFollowUpReminder(marker: string) {
  const rows = await db.reminders.toArray()
  const hits = rows.filter((r) => r.notes === marker)
  await Promise.all(hits.map((r) => db.reminders.delete(r.id)))
}

/** Keeps a single 'Custom' reminder in sync with the call's appointment date. */
async function syncFollowUpReminder(call: Call) {
  const marker = markerFor(call.id)
  await deleteFollowUpReminder(marker)
  if (!call.appointmentDate) return
  await db.reminders.add({
    id: uid(),
    customerId: call.customerId ?? '',
    type: 'Custom',
    title: `Call follow-up: ${call.name}`,
    dueDate: call.appointmentDate,
    done: false,
    notes: marker,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  })
}

export async function createCall(input: CallInput): Promise<Call> {
  const name = (input.name ?? '').trim()
  if (!name) throw new Error('Customer name is required.')
  const call: Call = {
    id: uid(),
    date: input.date || todayISO(),
    source: input.source ?? 'Direct',
    status: input.status ?? 'Pending',
    customerId: input.customerId || undefined,
    name,
    phone: input.phone?.trim() || undefined,
    contactPerson: input.contactPerson?.trim() || undefined,
    issue: input.issue?.trim() || undefined,
    priority: input.priority || undefined,
    appointmentDate: input.appointmentDate || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.transaction('rw', db.calls, db.reminders, async () => {
    await db.calls.add(call)
    await syncFollowUpReminder(call)
  })
  return call
}

export async function updateCall(id: string, patch: CallInput): Promise<Call> {
  const existing = await db.calls.get(id)
  if (!existing) throw new Error('Call not found. It may have been deleted.')
  const name = (patch.name ?? existing.name ?? '').trim()
  if (!name) throw new Error('Customer name is required.')
  const updated: Call = {
    ...existing,
    date: patch.date || existing.date,
    source: patch.source ?? existing.source,
    status: patch.status ?? existing.status,
    customerId: patch.customerId === undefined ? existing.customerId : patch.customerId || undefined,
    name,
    phone: patch.phone === undefined ? existing.phone : patch.phone?.trim() || undefined,
    contactPerson:
      patch.contactPerson === undefined
        ? existing.contactPerson
        : patch.contactPerson?.trim() || undefined,
    issue: patch.issue === undefined ? existing.issue : patch.issue?.trim() || undefined,
    priority: patch.priority === undefined ? existing.priority : patch.priority || undefined,
    appointmentDate:
      patch.appointmentDate === undefined
        ? existing.appointmentDate
        : patch.appointmentDate || undefined,
    notes: patch.notes === undefined ? existing.notes : patch.notes?.trim() || undefined,
    updatedAt: nowISO(),
  }
  await db.transaction('rw', db.calls, db.reminders, async () => {
    await db.calls.put(updated)
    await syncFollowUpReminder(updated)
  })
  return updated
}

export async function deleteCall(id: string) {
  await db.transaction('rw', db.calls, db.reminders, async () => {
    await deleteFollowUpReminder(markerFor(id))
    await db.calls.delete(id)
  })
}

export async function getCall(id: string) {
  return db.calls.get(id)
}

import { db, nowISO, uid } from '@/lib/db'
import type { Call, CallSource, CallStatus } from '@/types'
import { todayISO } from '@/utils/format'

export type CallDraft = Omit<Call, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Call, 'isDemo'>>

export interface CallInput {
  date?: string
  source: CallSource
  status?: CallStatus
  customerId?: string
  name?: string
  phone?: string
  notes?: string
}

function today(): string {
  return todayISO()
}

export async function createCall(input: CallInput): Promise<Call> {
  const name = (input.name ?? '').trim()
  if (!name) throw new Error('Caller name is required.')
  const call: Call = {
    id: uid(),
    date: input.date || today(),
    source: input.source,
    status: input.status ?? 'New',
    customerId: input.customerId || undefined,
    name,
    phone: input.phone?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.calls.add(call)
  return call
}

export async function updateCall(id: string, patch: CallInput): Promise<Call> {
  const existing = await db.calls.get(id)
  if (!existing) throw new Error('Call not found. It may have been deleted.')
  const name = (patch.name ?? existing.name ?? '').trim()
  if (!name) throw new Error('Caller name is required.')
  const updated: Call = {
    ...existing,
    date: patch.date || existing.date,
    source: patch.source ?? existing.source,
    status: patch.status ?? existing.status,
    customerId: patch.customerId === undefined ? existing.customerId : patch.customerId || undefined,
    name,
    phone: patch.phone === undefined ? existing.phone : patch.phone?.trim() || undefined,
    notes: patch.notes === undefined ? existing.notes : patch.notes?.trim() || undefined,
    updatedAt: nowISO(),
  }
  await db.calls.put(updated)
  return updated
}

export async function deleteCall(id: string) {
  await db.calls.delete(id)
}

export async function getCall(id: string) {
  return db.calls.get(id)
}

import { db, nowISO, uid } from '@/lib/db'
import type { Reminder } from '@/types'
import { daysUntil } from '@/utils/format'

export type ReminderDraft = Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'done'> &
  Partial<Pick<Reminder, 'done' | 'isDemo'>>

export async function createReminder(draft: ReminderDraft): Promise<Reminder> {
  if (!draft.title?.trim()) throw new Error('Reminder title is required.')
  if (!draft.dueDate) throw new Error('Due date is required.')
  const row: Reminder = {
    ...draft,
    id: uid(),
    done: draft.done ?? false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.reminders.add(row)
  return row
}

export async function toggleReminder(id: string, done: boolean) {
  const existing = await db.reminders.get(id)
  if (!existing) throw new Error('Reminder not found.')
  await db.reminders.put({ ...existing, done, updatedAt: nowISO() })
}

export async function deleteReminder(id: string) {
  await db.reminders.delete(id)
}

export type ReminderBucket = 'overdue' | 'today' | 'week' | 'month' | 'later'

export function bucketOf(dueDate: string): ReminderBucket {
  const d = daysUntil(dueDate)
  if (d === null) return 'later'
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 7) return 'week'
  if (d <= 31) return 'month'
  return 'later'
}

export function groupReminders(reminders: Reminder[]) {
  const groups: Record<ReminderBucket, Reminder[]> = {
    overdue: [],
    today: [],
    week: [],
    month: [],
    later: [],
  }
  for (const r of reminders) groups[bucketOf(r.dueDate)].push(r)
  for (const key of Object.keys(groups) as ReminderBucket[])
    groups[key].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return groups
}

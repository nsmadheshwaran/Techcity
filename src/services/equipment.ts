import { db, nextCode, nowISO, uid } from '@/lib/db'
import type { Equipment } from '@/types'
import { warrantyExpiryFrom } from '@/utils/format'

export type EquipmentDraft = Omit<Equipment, 'id' | 'code' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Equipment, 'isDemo'>>

export async function createEquipment(draft: EquipmentDraft): Promise<Equipment> {
  const customer = await db.customers.get(draft.customerId)
  if (!customer) throw new Error('Please select a valid customer for this equipment.')
  const code = await nextCode('equipment')
  const row: Equipment = {
    ...draft,
    id: uid(),
    code,
    warrantyExpiry:
      draft.warrantyExpiry ||
      (draft.installationDate
        ? warrantyExpiryFrom(draft.installationDate, draft.warrantyPeriod)
        : undefined),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.equipment.add(row)
  return row
}

export async function updateEquipment(id: string, patch: Partial<Equipment>) {
  const existing = await db.equipment.get(id)
  if (!existing) throw new Error('Equipment record not found.')
  const merged = { ...existing, ...patch }
  const updated: Equipment = {
    ...merged,
    warrantyExpiry:
      patch.warrantyExpiry !== undefined
        ? patch.warrantyExpiry
        : merged.installationDate
          ? warrantyExpiryFrom(merged.installationDate, merged.warrantyPeriod) ??
            existing.warrantyExpiry
          : existing.warrantyExpiry,
    id,
    updatedAt: nowISO(),
  }
  await db.equipment.put(updated)
  return updated
}

export async function deleteEquipment(id: string) {
  await db.equipment.delete(id)
}

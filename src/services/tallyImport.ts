import { db, nextCode, nowISO, uid } from '@/lib/db'
import type { Customer } from '@/types'
import { todayISO } from '@/utils/format'
import {
  fillBlanks,
  matchExisting,
  normalizeName,
  type TallyImportResult,
  type TallyParty,
} from './tallyParse'

export * from './tallyParse'

/**
 * Writes a parsed Tally customer master into the local store.
 *
 * Tally stays the book of record; this only mirrors WHO the customers are so
 * service history attaches to the same names the accounts use. It never writes
 * back to Tally and never tracks money — balances are quoted in the notes as
 * context only.
 */
function notesFor(party: TallyParty): string | undefined {
  const bits: string[] = []
  if (party.state) bits.push(party.state)
  if (party.openingBalance !== undefined) {
    // Tally holds a debtor's balance as a negative number.
    const owed = -party.openingBalance
    if (owed > 0) {
      bits.push(`Tally opening balance: ₹${owed.toLocaleString('en-IN')} due (not tracked here)`)
    }
  }
  return bits.length ? `Imported from Tally. ${bits.join('. ')}.` : 'Imported from Tally.'
}

/**
 * Writes the parsed parties into the local store.
 *
 * Existing records are never overwritten — only empty fields are filled in, so
 * a phone or address corrected in the app survives a re-import. Re-running the
 * import is therefore safe and idempotent.
 */
export async function importTallyCustomers(
  parties: TallyParty[],
  gstins?: Map<string, string>,
): Promise<TallyImportResult> {
  const existing = await db.customers.toArray()
  const seenThisRun: Customer[] = [...existing]

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const raw of parties) {
    const party: TallyParty = {
      ...raw,
      gstNumber: raw.gstNumber || gstins?.get(normalizeName(raw.name)),
    }

    const match = matchExisting(party, seenThisRun)
    if (match) {
      const patch = fillBlanks(match, party)
      if (Object.keys(patch).length === 0) {
        unchanged += 1
        continue
      }
      const next: Customer = { ...match, ...patch, updatedAt: nowISO() }
      await db.customers.put(next)
      const idx = seenThisRun.findIndex((c) => c.id === match.id)
      if (idx >= 0) seenThisRun[idx] = next
      updated += 1
      continue
    }

    const customer: Customer = {
      id: uid(),
      code: await nextCode('customer'),
      name: party.name,
      phone: party.phone,
      address: party.address,
      city: party.city,
      pincode: party.pincode,
      gstNumber: party.gstNumber,
      notes: notesFor(party),
      dateAdded: todayISO(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    await db.customers.add(customer)
    seenThisRun.push(customer)
    created += 1
  }

  return {
    created,
    updated,
    unchanged,
    withoutPhone: parties.filter((p) => !p.phone).length,
  }
}

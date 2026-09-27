import type { Customer } from '@/types'

/**
 * Pure parsing and matching for the Tally importer — no database, no browser
 * APIs beyond TextDecoder, so it can be exercised directly against a real
 * export without standing the app up.
 *
 * Regular expressions rather than DOMParser on purpose: Tally emits
 * control-character entities (`&#4; Not Applicable` appears throughout these
 * exports) which XML 1.0 forbids, so a conforming parser rejects the document.
 */

export interface TallyParty {
  name: string
  phone?: string
  address?: string
  city?: string
  pincode?: string
  state?: string
  gstNumber?: string
  /** Tally's opening balance. Negative means the customer owes the business. */
  openingBalance?: number
}

export interface TallyImportPreview {
  company?: string
  customers: TallyParty[]
  /** Sundry Creditors, counted but not imported — the app has no supplier record. */
  supplierCount: number
  withoutPhone: number
}

export interface TallyImportResult {
  created: number
  updated: number
  unchanged: number
  withoutPhone: number
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

/** Tally writes UTF-16; the BOM is usually there but not always. */
export function decodeTallyXml(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer)
  // No BOM: ASCII text held as UTF-16LE has a zero as every second byte.
  if (bytes.length > 3 && bytes[1] === 0x00 && bytes[3] === 0x00) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  return new TextDecoder('utf-8').decode(buffer)
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Tally's "&#4;" prefixes on option values carry no meaning for us.
    .replace(/&#\d+;/g, '')
    .trim()
}

function tagValue(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block)
  return m ? decodeEntities(m[1]) : ''
}

function allTagValues(block: string, tag: string): string[] {
  return [...block.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))]
    .map((m) => decodeEntities(m[1]))
    .filter(Boolean)
}

function firstPhone(block: string): string | undefined {
  const candidates = [tagValue(block, 'LEDGERMOBILE'), ...allTagValues(block, 'PHONENUMBER'),
    tagValue(block, 'LEDGERPHONE')]
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length >= 10) return raw.trim()
  }
  return undefined
}

/** Reads the Sundry Debtors out of an "All Masters" export. */
export function parseTallyMasters(xml: string): TallyImportPreview {
  const company = tagValue(xml, 'SVCURRENTCOMPANY') || undefined
  const customers: TallyParty[] = []
  let supplierCount = 0

  for (const match of xml.matchAll(/<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/g)) {
    const attrs = match[1]
    const block = match[2]
    const parent = tagValue(block, 'PARENT')

    if (/creditor/i.test(parent)) {
      supplierCount += 1
      continue
    }
    if (!/debtor/i.test(parent)) continue

    const nameAttr = /NAME="([^"]*)"/.exec(attrs)
    const name = decodeEntities(nameAttr?.[1] ?? '') || tagValue(block, 'MAILINGNAME')
    if (!name) continue

    // Tally's address lines usually already end in a comma, so strip trailing
    // punctuation before joining or the result reads "Nivas,, Street,,".
    const addressLines = allTagValues(block, 'ADDRESS').map((l) => l.replace(/[,\s]+$/, ''))
    // Tally's last address line is conventionally the town.
    const city = addressLines.length > 1 ? addressLines[addressLines.length - 1] : ''
    const street = addressLines.length > 1 ? addressLines.slice(0, -1) : addressLines

    const pin = tagValue(block, 'PINCODE').replace(/\s+/g, '')
    const openingRaw = tagValue(block, 'OPENINGBALANCE')
    const opening = openingRaw ? Number(openingRaw) : NaN

    customers.push({
      name,
      phone: firstPhone(block),
      address: street.join(', ') || undefined,
      city: city || undefined,
      pincode: /^\d{6}$/.test(pin) ? pin : undefined,
      state: tagValue(block, 'STATE') || tagValue(block, 'LEDSTATENAME') || undefined,
      gstNumber: tagValue(block, 'PARTYGSTIN') || undefined,
      openingBalance: Number.isFinite(opening) && opening !== 0 ? opening : undefined,
    })
  }

  return {
    company,
    customers,
    supplierCount,
    withoutPhone: customers.filter((c) => !c.phone).length,
  }
}

/**
 * Tally keeps a customer's GSTIN on the invoices rather than the ledger in
 * these exports (53 of 67 sales vouchers carry one, none of the ledgers do),
 * so the day book is worth reading purely to fill that gap in.
 */
export function parseGstinsFromDayBook(xml: string): Map<string, string> {
  const byParty = new Map<string, string>()
  for (const match of xml.matchAll(/<VOUCHER\b[^>]*>([\s\S]*?)<\/VOUCHER>/g)) {
    const block = match[1]
    const party = tagValue(block, 'PARTYLEDGERNAME') || tagValue(block, 'PARTYNAME')
    const gstin = tagValue(block, 'PARTYGSTIN')
    if (party && /^[0-9A-Z]{15}$/i.test(gstin) && !byParty.has(normalizeName(party))) {
      byParty.set(normalizeName(party), gstin.toUpperCase())
    }
  }
  return byParty
}

/* ------------------------------------------------------------------ */
/* Matching + import                                                   */
/* ------------------------------------------------------------------ */

/** Loose key for comparing party names across two systems. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|co|company|and|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function phoneKey(value?: string): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : ''
}

/**
 * Finds the record an imported party corresponds to. Phone wins when both
 * sides have one, because two businesses can share a trading name far more
 * easily than a number; otherwise fall back to the normalised name.
 */
export function matchExisting(
  party: TallyParty,
  existing: Customer[],
): Customer | undefined {
  const key = phoneKey(party.phone)
  if (key) {
    const byPhone = existing.find((c) => phoneKey(c.phone) === key)
    if (byPhone) return byPhone
  }
  const name = normalizeName(party.name)
  if (!name) return undefined
  return existing.find((c) => normalizeName(c.name) === name)
}

/** Fields an existing record should pick up — only where it has nothing yet. */
export function fillBlanks(existing: Customer, party: TallyParty): Partial<Customer> {
  const patch: Partial<Customer> = {}
  if (!existing.phone && party.phone) patch.phone = party.phone
  if (!existing.address && party.address) patch.address = party.address
  if (!existing.city && party.city) patch.city = party.city
  if (!existing.pincode && party.pincode) patch.pincode = party.pincode
  if (!existing.gstNumber && party.gstNumber) patch.gstNumber = party.gstNumber
  return patch
}


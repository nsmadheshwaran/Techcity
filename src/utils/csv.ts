/** Minimal CSV serialisation + browser download helpers (no external deps). */

export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (!rows.length) return headers?.join(',') ?? ''
  const cols = headers ?? Object.keys(rows[0])
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [cols.join(',')]
  for (const row of rows) lines.push(cols.map((c) => escape(row[c])).join(','))
  return lines.join('\r\n')
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string, headers?: string[]) {
  // BOM keeps Excel happy with ₹ and other unicode characters.
  downloadBlob('\uFEFF' + toCSV(rows, headers), filename, 'text/csv;charset=utf-8;')
}

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json')
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read the selected file'))
    reader.readAsText(file)
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read the selected file'))
    reader.readAsDataURL(file)
  })
}

export function timestampSuffix(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}`
}

/**
 * Parses CSV text into row objects keyed by the header row. Handles quoted
 * fields containing commas, embedded newlines and escaped quotes ("") —
 * the same escaping toCSV() produces, so an exported file always re-imports
 * correctly, and handles a handwritten/Excel-exported CSV too.
 */
export function parseCSV(text: string): Record<string, string>[] {
  // Strip a UTF-8 BOM, which downloadCSV() writes and Excel also writes.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < clean.length) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      pushField()
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }
  // Final field/row, unless the file ended cleanly on a newline.
  if (field.length > 0 || row.length > 0) pushRow()

  if (!rows.length) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (h) obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
}

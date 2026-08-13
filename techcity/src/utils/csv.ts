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

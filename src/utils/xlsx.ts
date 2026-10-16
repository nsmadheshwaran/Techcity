/**
 * Minimal, dependency-free .xlsx writer.
 *
 * The obvious shortcut — write a CSV and name it .xlsx — produces a file
 * Excel refuses to open without a "file format doesn't match extension"
 * warning, which is worse than just giving CSV. The SheetJS `xlsx` package
 * would do this properly, but its two high-severity CVEs are both in the
 * PARSING path (prototype pollution / ReDoS reading an untrusted file) and
 * this app only ever WRITES its own data — pulling in ~1MB of dependency
 * carrying that exposure for a flat table export isn't worth it.
 *
 * An .xlsx is just a ZIP of a handful of small XML files, so this builds
 * that ZIP by hand: no compression (the "stored" method), which keeps the
 * zip writer to a page of code at the cost of a slightly larger file —
 * irrelevant at the row counts a single shop's export ever reaches.
 */

/* ------------------------------------------------------------------ */
/* ZIP (stored, no compression)                                        */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/**
 * Re-backs a Uint8Array by a concrete ArrayBuffer. TextEncoder#encode() is
 * typed as returning Uint8Array<ArrayBufferLike> under some lib/target
 * combinations, which Blob's BlobPart (ArrayBufferView<ArrayBuffer>) then
 * rejects — this guarantees the narrower type without copying semantics
 * that matter here (the bytes are freshly allocated either way).
 */
function asBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer)
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(): { date: number; time: number } {
  const d = new Date()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { date, time }
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Builds a minimal valid ZIP archive (store method) from named byte blobs. */
function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const { date, time } = dosDateTime()
  const chunks: BlobPart[] = []
  const central: BlobPart[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // local file header signature
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0, true) // flags
    local.setUint16(8, 0, true) // method: stored
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true) // compressed size
    local.setUint32(22, size, true) // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra field length

    chunks.push(local.buffer, asBufferView(nameBytes), asBufferView(entry.data))

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true) // central directory signature
    cd.setUint16(4, 20, true) // version made by
    cd.setUint16(6, 20, true) // version needed
    cd.setUint16(8, 0, true)
    cd.setUint16(10, 0, true) // method: stored
    cd.setUint16(12, time, true)
    cd.setUint16(14, date, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, size, true)
    cd.setUint32(24, size, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint16(30, 0, true) // extra length
    cd.setUint16(32, 0, true) // comment length
    cd.setUint16(34, 0, true) // disk number
    cd.setUint16(36, 0, true) // internal attrs
    cd.setUint32(38, 0, true) // external attrs
    cd.setUint32(42, offset, true) // offset of local header

    central.push(cd.buffer, asBufferView(nameBytes))
    offset += local.buffer.byteLength + nameBytes.length + size
  }

  const centralSize = central.reduce(
    (sum, part) => sum + (part instanceof ArrayBuffer ? part.byteLength : (part as Uint8Array).length),
    0,
  )
  const centralOffset = offset

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true) // end of central directory signature
  end.setUint16(4, 0, true)
  end.setUint16(6, 0, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, centralOffset, true)
  end.setUint16(20, 0, true) // comment length

  return new Blob([...chunks, ...central, end.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* ------------------------------------------------------------------ */
/* XLSX package                                                        */
/* ------------------------------------------------------------------ */

function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Converts a 0-based column index to its spreadsheet letter (0 -> A, 26 -> AA). */
function colLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

// Index 0 = default; index 1 = bold, used for the header row.
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><sz val="10"/><name val="Calibri"/><b/></font>
  </fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function sheetXml(rows: Record<string, unknown>[], headers?: string[]): string {
  const cols = headers ?? (rows[0] ? Object.keys(rows[0]) : [])
  const allRows = [cols, ...rows.map((r) => cols.map((c) => r[c]))]

  const rowsXml = allRows
    .map((cells, rowIdx) => {
      const r = rowIdx + 1
      const styleAttr = rowIdx === 0 ? ' s="1"' : ''
      const cellsXml = (cells as unknown[])
        .map((cellValue, colIdx) => {
          const ref = `${colLetter(colIdx)}${r}`
          // Everything is an inline string: numbers formatted the way the rest
          // of the app formats them (currency, dates) should stay text, and a
          // product code or phone number must never be reinterpreted as a
          // number and lose its leading zero.
          const text = escapeXml(cellValue)
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${text}</t></is></c>`
        })
        .join('')
      return `<row r="${r}">${cellsXml}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`
}

/** Builds a single-sheet .xlsx workbook from rows, in the same shape toCSV() takes. */
export function toXLSX(rows: Record<string, unknown>[], headers?: string[]): Blob {
  const encoder = new TextEncoder()
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encoder.encode(WORKBOOK_XML) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS) },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml(rows, headers)) },
  ]
  return buildZip(entries)
}

export function downloadXLSX(rows: Record<string, unknown>[], filename: string, headers?: string[]) {
  const blob = toXLSX(rows, headers)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

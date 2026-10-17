/**
 * Minimal, dependency-free .xlsx reader — the counterpart to xlsx.ts (the
 * writer). Same reasoning as there: the SheetJS `xlsx` npm package's two
 * high-severity CVEs are both in this exact path (parsing a file someone
 * hands you), so pulling in ~1MB of dependency carrying that exposure isn't
 * worth it for "read a stock list".
 *
 * An .xlsx is a ZIP of small XML files. Real spreadsheets (Excel, Google
 * Sheets, LibreOffice) deflate-compress those entries, so this needs an
 * inflate implementation — provided by the browser's own
 * DecompressionStream('deflate-raw'), not re-implemented by hand. That API
 * has been in every evergreen browser since 2023; where it is missing this
 * throws a clear error telling the owner to save as CSV instead.
 *
 * Only the first worksheet is read, which is what "open this spreadsheet"
 * means for the overwhelming majority of stock lists shop owners keep.
 */

interface ZipEntry {
  name: string
  compressedData: Uint8Array
  method: number // 0 = stored, 8 = deflate
}

function readUint32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}
function readUint16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

/** Locates and parses the ZIP central directory, independent of any compression method. */
function parseZipEntries(buf: ArrayBuffer): Map<string, ZipEntry> {
  const bytes = new Uint8Array(buf)
  const view = new DataView(buf)

  // End Of Central Directory: scan backward for its signature. A ZIP comment
  // (rare in .xlsx) can push it up to 65557 bytes from the end.
  const EOCD_SIG = 0x06054b50
  let eocd = -1
  const scanFrom = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= scanFrom; i--) {
    if (readUint32LE(view, i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('Not a valid .xlsx file (no ZIP end-of-directory record found).')

  const entryCount = readUint16LE(view, eocd + 10)
  let offset = readUint32LE(view, eocd + 16)

  const entries = new Map<string, ZipEntry>()
  const decoder = new TextDecoder('utf-8')

  for (let i = 0; i < entryCount; i++) {
    const sig = readUint32LE(view, offset)
    if (sig !== 0x02014b50) throw new Error('Corrupt .xlsx file (bad central directory entry).')

    const method = readUint16LE(view, offset + 10)
    const compressedSize = readUint32LE(view, offset + 20)
    const nameLen = readUint16LE(view, offset + 28)
    const extraLen = readUint16LE(view, offset + 30)
    const commentLen = readUint16LE(view, offset + 32)
    const localHeaderOffset = readUint32LE(view, offset + 42)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen))

    // Local header tells us exactly where this entry's data starts (its own
    // name/extra lengths can differ slightly from the central directory's).
    const localNameLen = readUint16LE(view, localHeaderOffset + 26)
    const localExtraLen = readUint16LE(view, localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen

    entries.set(name, {
      name,
      method,
      compressedData: bytes.subarray(dataStart, dataStart + compressedSize),
    })

    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflateEntry(entry: ZipEntry): Promise<string> {
  if (entry.method === 0) return new TextDecoder('utf-8').decode(entry.compressedData)
  if (entry.method !== 8) {
    throw new Error(`Unsupported compression in .xlsx (method ${entry.method}).`)
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'This browser cannot read compressed .xlsx files. Please save the file as CSV and import that instead.',
    )
  }
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([entry.compressedData as BlobPart]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new TextDecoder('utf-8').decode(buf)
}

/* ------------------------------------------------------------------ */
/* XML parsing — just enough for a spreadsheet, no DOMParser dependency */
/* ------------------------------------------------------------------ */

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
}

/** sharedStrings.xml -> ordered array of strings, referenced by <c t="s"><v>index</v></c>. */
function parseSharedStrings(xml: string): string[] {
  const strings: string[] = []
  for (const siMatch of xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)) {
    const block = siMatch[1]
    // A shared string is either one <t> or several <r><t>…</t></r> runs to join.
    const texts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1]))
    strings.push(texts.join(''))
  }
  return strings
}

/** Column letters ("A", "AB"…) from a cell reference like "C7" -> 0-based index. */
function columnIndexFromRef(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** sheet1.xml -> rows of raw cell strings, indexed by column (gaps = blank cells). */
function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowXml = rowMatch[1]
    const row: string[] = []
    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1]
      const inner = cellMatch[2] ?? ''
      const ref = /r="([^"]+)"/.exec(attrs)?.[1]
      const type = /t="([^"]+)"/.exec(attrs)?.[1]
      const col = ref ? columnIndexFromRef(ref) : row.length

      let value = ''
      if (type === 'inlineStr') {
        value = decodeXmlEntities([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))
      } else {
        const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? ''
        if (type === 's') {
          value = sharedStrings[Number(v)] ?? ''
        } else {
          value = decodeXmlEntities(v)
        }
      }
      row[col] = value
    }
    rows.push(row)
  }
  return rows
}

/**
 * Reads the first worksheet of a .xlsx file into row objects keyed by the
 * header row — the same shape toCSV()/toXLSX() rows already use throughout
 * the app, so the result can go straight into existing import/matching code.
 */
export async function readXLSX(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer()
  const entries = parseZipEntries(buf)

  const sheetEntry = entries.get('xl/worksheets/sheet1.xml')
  if (!sheetEntry) throw new Error('That file does not look like a spreadsheet (no worksheet found).')

  const sharedStringsEntry = entries.get('xl/sharedStrings.xml')
  const sharedStrings = sharedStringsEntry ? parseSharedStrings(await inflateEntry(sharedStringsEntry)) : []

  const sheetXml = await inflateEntry(sheetEntry)
  const rows = parseSheetRows(sheetXml, sharedStrings)
  if (!rows.length) return []

  const headers = rows[0].map((h) => (h ?? '').trim())
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = (row[i] ?? '').trim()
    })
    return obj
  })
}

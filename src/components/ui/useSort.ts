import { useCallback, useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

/** What a sortable column pulls out of a row. `null`/`undefined` sorts last. */
export type SortAccessors<T, K extends string> = Record<
  K,
  (row: T) => string | number | null | undefined
>

/**
 * Column sorting for a list view.
 *
 * `key === null` means "no explicit sort", which lets each page keep its own
 * natural order (newest first, usually) until the user actually clicks a
 * header. Clicking the active column flips direction; clicking a new one
 * starts ascending.
 */
export function useSort<K extends string>(initialKey: K | null = null, initialDir: SortDir = 'asc') {
  const [key, setKey] = useState<K | null>(initialKey)
  const [dir, setDir] = useState<SortDir>(initialDir)

  const toggle = useCallback((next: K) => {
    setKey((prev) => {
      if (prev === next) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setDir('asc')
      }
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setKey(null)
    setDir('asc')
  }, [])

  return { key, dir, toggle, reset, setKey, setDir }
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined) {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  // Blanks always sink to the bottom, whichever direction is active — a column
  // of empty cells at the top is never what the user wanted.
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Returns `rows` ordered by the active column, or unchanged when nothing is
 * sorted. Blanks stay last in both directions, so only the populated rows flip.
 */
export function useSorted<T, K extends string>(
  rows: T[],
  key: K | null,
  dir: SortDir,
  accessors: SortAccessors<T, K>,
): T[] {
  return useMemo(() => {
    if (!key) return rows
    const get = accessors[key]
    if (!get) return rows
    const sign = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      const aEmpty = av === null || av === undefined || av === ''
      const bEmpty = bv === null || bv === undefined || bv === ''
      if (aEmpty || bEmpty) return compare(av, bv)
      return compare(av, bv) * sign
    })
    // `accessors` is rebuilt every render by callers, so it is intentionally
    // not a dependency — the key/dir/rows triple is what actually changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir])
}

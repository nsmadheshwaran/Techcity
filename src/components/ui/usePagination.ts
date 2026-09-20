import { useEffect, useMemo, useState } from 'react'

/** Client side pagination — keeps big tables fast with thousands of rows. */
export function usePagination<T>(items: T[] | undefined, pageSize = 20) {
  const [page, setPage] = useState(1)
  const total = items?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > pageCount) setPage(1)
  }, [page, pageCount])

  const slice = useMemo(
    () => (items ?? []).slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  )

  return { page, setPage, pageCount, total, slice, pageSize }
}

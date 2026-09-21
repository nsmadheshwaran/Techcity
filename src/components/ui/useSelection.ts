import { useCallback, useMemo, useState } from 'react'

/**
 * Row selection for bulk actions.
 *
 * Selection is tracked by id rather than by index so it survives re-sorting,
 * re-filtering and pagination. `visibleIds` is whatever the user can currently
 * see, which is what the header checkbox acts on — "select all" on a filtered
 * list means the filtered rows, never the whole table.
 */
export function useSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const visibleSelected = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  )

  const allVisibleSelected = visibleIds.length > 0 && visibleSelected.length === visibleIds.length
  const someVisibleSelected = visibleSelected.length > 0 && !allVisibleSelected

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const everySelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
      for (const id of visibleIds) {
        if (everySelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [visibleIds])

  return {
    selected,
    /** Only the ids that are both selected and currently on screen. */
    selectedIds: visibleSelected,
    count: visibleSelected.length,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAllVisible,
    allVisibleSelected,
    someVisibleSelected,
    clear,
  }
}

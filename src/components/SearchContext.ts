import { createContext, useContext } from 'react'

export const SearchContext = createContext<{ open: () => void } | null>(null)

export function useGlobalSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useGlobalSearch must be used inside <GlobalSearchProvider>')
  return ctx
}

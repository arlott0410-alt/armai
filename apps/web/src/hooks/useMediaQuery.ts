import { useState, useEffect } from 'react'

/**
 * Match a media query. Use for responsive layout: e.g. isDesktop = useMediaQuery('(min-width: 768px)').
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const m = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(m.matches)
    m.addEventListener('change', handler)
    return () => m.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Desktop breakpoint: 768px and up — sidebar. Below: drawer. */
export const DESKTOP_BREAKPOINT = '(min-width: 768px)'

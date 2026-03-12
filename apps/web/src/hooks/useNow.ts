import { useEffect, useState } from 'react'

/**
 * Returns current timestamp, set in useEffect to satisfy react-hooks/purity.
 * Optionally refreshes every intervalMs (e.g. 60_000 for countdown).
 */
export function useNow(intervalMs?: number): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const readTime = () => Date.now()
    setNow(readTime())
    if (intervalMs == null || intervalMs <= 0) return
    const id = setInterval(() => setNow(readTime()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Days left until trialEndsAt (ISO string), given current timestamp from useNow(). */
export function getTrialDaysLeft(trialEndsAt: string | null | undefined, now: number): number {
  if (!trialEndsAt || now <= 0) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / (24 * 60 * 60 * 1000)))
}

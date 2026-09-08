import { useCallback, useState } from 'react'

/**
 * usePersistentCollapsed — collapse/expand state persisted to localStorage.
 *
 * Used by dashboard cards (postpaid billing panel, referral card) that the
 * user can fold away to save screen space. Semantics:
 *   • Default is ALWAYS expanded (false) — sections show until the user
 *     explicitly collapses them.
 *   • The choice persists under `key` so the user doesn't have to re-hide
 *     the section on every visit.
 *   • localStorage failures (private browsing, quota) are swallowed — the
 *     toggle still works in-memory, it just won't survive a reload.
 *
 * Returns [collapsed, toggleCollapsed].
 */
export function usePersistentCollapsed(key: string) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // storage unavailable — keep in-memory state only
      }
      return next
    })
  }, [key])

  return [collapsed, toggleCollapsed] as const
}

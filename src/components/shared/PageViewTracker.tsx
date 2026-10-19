import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { trackPageView } from '@/lib/analytics'

/**
 * Product analytics (Task 72): records exactly one PAGE_VIEW per SPA
 * navigation. Rendered ONCE inside the root route — renders nothing.
 *
 * Failure contract: trackPageView is fully silent (wrapped + swallowed),
 * so this component can never affect routing, rendering or data loading.
 */
export function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  return null
}

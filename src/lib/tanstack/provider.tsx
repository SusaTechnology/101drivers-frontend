import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { getLastKnownRoles } from './dataQuery'

const SESSION_EXPIRED_MSG = 'Session expired'

// Retry policy for queries.
//
// Client errors (400/401/403/404/409/422...) are permanent for an identical
// request — retrying them only delays the error UI and, for 401s, hammers
// the token-refresh endpoint. 408/429 are client-class but retryable by
// definition, and 5xx + pure network failures (fetch TypeError carries no
// status) are transient — those are exactly the "backend restarting for a
// deploy" cases where an automatic retry turns a random "failed to load"
// into a seamless recovery.
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false
  const status = (error as { status?: number })?.status
  if (typeof status === 'number') {
    if (status === 408 || status === 429) return true
    return status >= 500
  }
  return true
}

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: shouldRetryQuery,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

// Global handler: when any query/mutation fails with "Session expired",
// redirect to the correct role-specific login instead of showing a broken retry UI.
queryClient.getQueryCache().config.onError = (error) => {
  if (error?.message?.includes(SESSION_EXPIRED_MSG)) {
    redirectToLogin()
  }
}
queryClient.getMutationCache().config.onError = (error) => {
  if (error?.message?.includes(SESSION_EXPIRED_MSG)) {
    redirectToLogin()
  }
}

let isRedirecting = false
function redirectToLogin() {
  if (isRedirecting) return
  isRedirecting = true

  // Determine the correct sign-in page based on the user's role.
  // clearAuth() has already been called by refreshAccessToken(), so we use
  // getLastKnownRoles() which snapshots roles before the wipe.
  const roles = getLastKnownRoles()

  let loginPath: string
  if (roles.includes('DRIVER')) {
    loginPath = '/driver-signin?session=expired'
  } else if (roles.includes('ADMIN')) {
    loginPath = '/auth/admin-signin?session=expired'
  } else {
    // Dealer / customer (PRIVATE_CUSTOMER, BUSINESS_CUSTOMER) or fallback
    loginPath = '/auth/dealer-signin?session=expired'
  }

  window.location.replace(loginPath)
}

interface AppProvidersProps {
  children: ReactNode
}

export function Providers({ children }: AppProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          richColors
          position="top-center"
          // iPhone / PWA safe-area fix: offset the toast VIEWPORT itself below
          // the notch/status bar (and above the home indicator at the bottom).
          // The previous approach padded the inside of each toast, which left
          // the card's top edge at y=0 — under the notch — so on iPhones the
          // user only saw a colored sliver of the toast. Sonner v2 accepts CSS
          // strings per edge, and env() inside them resolves per-device: 0 on
          // desktop, notch height on iPhone (Safari + installed PWA).
          //
          // The top offset ALSO scales the inset by 1.5x: on a notched iPhone
          // the toast lands ~1/3 lower (~82px vs ~59px) so it clears the
          // status bar comfortably ("a bit lower"), while on desktop/Android
          // (inset = 0) the offset stays 12px exactly as before.
          offset={{
            top: 'calc(env(safe-area-inset-top, 0px) * 1.5 + 12px)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          }}
          toastOptions={{ className: 'font-sans' }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
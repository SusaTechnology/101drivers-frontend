import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { getLastKnownRoles } from './dataQuery'

const SESSION_EXPIRED_MSG = 'Session expired'

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
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
          toastOptions={{
            className: 'font-sans',
            style: {
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
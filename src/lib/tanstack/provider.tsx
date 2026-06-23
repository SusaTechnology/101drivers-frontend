import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'

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
// redirect to dealer login instead of showing a broken retry UI.
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
  // Use location.replace so user can't go back to the broken state
  window.location.replace('/auth/dealer-signin?session=expired')
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
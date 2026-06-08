import { createFileRoute } from '@tanstack/react-router'
import { DealerSignIn } from '@/components/auth/DealerSignIn'
import { ThemeProvider } from '@/lib/theme'

export const Route = createFileRoute('/auth/admin-signin')({
  component: DealerSignInPage,
})

function DealerSignInPage() {
    // const search = Route.useSearch() as { userType?: string }
//   const userType = search.userType === 'driver' ? 'driver' : search.userType === 'admin'? 'admin' :'dealer'

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DealerSignIn userType="admin" />
    </ThemeProvider>
  )
}
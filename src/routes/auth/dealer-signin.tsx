import { createFileRoute } from '@tanstack/react-router'
import { DealerSignIn } from '@/components/auth/DealerSignIn'
import { ThemeProvider } from '@/lib/theme'

export const Route = createFileRoute('/auth/dealer-signin')({
  component: DealerSignInPage,
})

function DealerSignInPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DealerSignIn userType="dealer" />
    </ThemeProvider>
  )
}

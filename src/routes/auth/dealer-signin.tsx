import { createFileRoute } from '@tanstack/react-router'
import { DealerSignIn } from '@/components/auth/DealerSignIn'
import { ThemeProvider } from 'next-themes'

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

import { createFileRoute } from '@tanstack/react-router'
import { DealerSignUp } from '@/components/auth/dealer-signup'

export const Route = createFileRoute('/auth/dealer-signup')({
  component: DealerSignUpPage,
})

function DealerSignUpPage() {
  return <DealerSignUp />
}
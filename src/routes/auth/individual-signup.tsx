import { createFileRoute } from '@tanstack/react-router'
import { IndividualSignUp } from '@/components/auth/individual-signup'

export const Route = createFileRoute('/auth/individual-signup')({
  component: IndividualSignUpPage,
})

function IndividualSignUpPage() {
  return <IndividualSignUp />
}

import { AcceptInvite } from '@/components/auth/AcceptInvite'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// Search params schema for the admin invite acceptance page.
// The token arrives from the email link:
//   /auth/accept-invite?token=<single-use setup token>
const acceptInviteSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/auth/accept-invite')({
  component: RouteComponent,
  validateSearch: acceptInviteSearchSchema,
})

function RouteComponent() {
  return <AcceptInvite />
}

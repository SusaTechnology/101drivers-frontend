import { ResetPassword } from '@/components/auth/forgot-password'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// Search params schema for reset-password route
const resetPasswordSearchSchema = z.object({
  email: z.string().optional(),
})

export const Route = createFileRoute('/auth/reset-password')({
  component: RouteComponent,
  validateSearch: resetPasswordSearchSchema,
})

function RouteComponent() {
  return <ResetPassword />
}

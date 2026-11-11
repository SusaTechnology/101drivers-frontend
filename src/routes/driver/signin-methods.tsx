import { createFileRoute } from '@tanstack/react-router'
import { DriverRouteGuard } from '@/components/auth/DriverRouteGuard'
import { DriverSignInMethods } from '@/components/auth/DriverSignInMethods'

/** "Sign-in methods" — linked providers, linking, password management. */
export const Route = createFileRoute('/driver/signin-methods')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DriverRouteGuard>
      <DriverSignInMethods />
    </DriverRouteGuard>
  )
}

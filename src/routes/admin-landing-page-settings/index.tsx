import AdminLandingPageSettings from "@/components/pages/admin-landing-page-settings";
import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute("/admin-landing-page-settings/")({
  component: AdminGuardedRoute,
});

function AdminGuardedRoute() {
  return (
    <AdminRouteGuard>
      <RouteComponent />
    </AdminRouteGuard>
  )
}

function RouteComponent() {
  return <AdminLandingPageSettings />;
}

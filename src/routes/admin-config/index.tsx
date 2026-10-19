import AdminConfigHubPage from "@/components/pages/admin-config";
import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute("/admin-config/")({
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
  return <AdminConfigHubPage />;
}

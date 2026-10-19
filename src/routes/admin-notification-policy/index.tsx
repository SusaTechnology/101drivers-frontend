import AdminNotificationPolicyPage from "@/components/pages/admin-notification-policy";
import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute("/admin-notification-policy/")({
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
  return <AdminNotificationPolicyPage />;
}

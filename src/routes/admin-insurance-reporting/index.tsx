import AdminInsuranceReportingPage from "@/components/pages/admin-insurance-reporting";
import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute("/admin-insurance-reporting/")({
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
  return <AdminInsuranceReportingPage />;
}

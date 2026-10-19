import AdminDisputeDetailsPage from "@/components/pages/admin-dispute-details";
import { createFileRoute } from "@tanstack/react-router";
import { AdminRouteGuard } from '@/components/auth/AdminRouteGuard'

export const Route = createFileRoute("/admin-dispute-detail/")({
  component: AdminGuardedRoute,
  validateSearch: (search: Record<string, unknown>): { disputeId: string } => {
    return {
      disputeId: (search.disputeId as string) || '',
    };
  },
});

function AdminGuardedRoute() {
  return (
    <AdminRouteGuard>
      <RouteComponent />
    </AdminRouteGuard>
  )
}

function RouteComponent() {
  const { disputeId } = Route.useSearch();
  return <AdminDisputeDetailsPage disputeId={disputeId} />;
}

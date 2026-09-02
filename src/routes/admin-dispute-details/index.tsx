import AdminDisputeDetailsPage from "@/components/pages/admin-dispute-details";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-dispute-details/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { disputeId: string } => {
    return {
      disputeId: (search.disputeId as string) || '',
    };
  },
});

function RouteComponent() {
  const { disputeId } = Route.useSearch();
  return <AdminDisputeDetailsPage disputeId={disputeId} />;
}

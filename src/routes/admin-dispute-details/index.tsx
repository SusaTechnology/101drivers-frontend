import AdminDisputeDetailsPage from "@/components/pages/admin-dispute-details";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-dispute-details/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminDisputeDetailsPage />;
}

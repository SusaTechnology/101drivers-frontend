import DealerDashboard from "@/components/pages/dealer-dashboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-dashboard/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <DealerDashboard />;
}

import AdminConfigHubPage from "@/components/pages/admin-config";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-config/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminConfigHubPage />;
}

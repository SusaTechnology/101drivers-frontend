import AdminHomePageSettings from "@/components/pages/admin-home-page-settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-home-page-settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminHomePageSettings />;
}

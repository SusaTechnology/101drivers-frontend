import AdminLandingPageSettings from "@/components/pages/admin-landing-page-settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-landing-page-settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminLandingPageSettings />;
}

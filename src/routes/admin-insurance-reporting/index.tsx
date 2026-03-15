import AdminInsuranceReportingPage from "@/components/pages/admin-insurance-reporting.";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-insurance-reporting/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminInsuranceReportingPage />;
}

import AdminNotificationPolicyPage from "@/components/pages/admin-notification-policy";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-notification-policy/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminNotificationPolicyPage />;
}

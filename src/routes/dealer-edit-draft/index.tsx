import EditDraftPage from "@/components/pages/dealer-edit-draft";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-edit-draft/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <EditDraftPage />;
}

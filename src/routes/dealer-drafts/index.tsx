import DealerDrafts from "@/components/pages/dealer-drafts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-drafts/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <DealerDrafts />;
}

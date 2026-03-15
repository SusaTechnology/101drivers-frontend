import CreateDeliveryPage from "@/components/pages/dealer-create-delivery";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-create-delivery/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <CreateDeliveryPage />;
}

import ReviewDeliveryPage from "@/components/pages/dealer-review-delivery";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-review-delivery/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ReviewDeliveryPage />;
}

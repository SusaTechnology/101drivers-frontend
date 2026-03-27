import TermsOfService from "@/components/pages/terms";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <TermsOfService />;
}

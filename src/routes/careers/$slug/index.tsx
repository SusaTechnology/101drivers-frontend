import { createFileRoute } from "@tanstack/react-router";
import CareerDetailPage from "@/components/pages/career-detail";

/**
 * /careers/$slug — one dynamic route for every role in the
 * src/content/careers registry. The detail page validates the slug
 * against the registry and renders the not-found state for unknown
 * slugs, so new roles need no route changes.
 */
export const Route = createFileRoute("/careers/$slug/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <CareerDetailPage slug={slug} />;
}

import { createFileRoute } from "@tanstack/react-router";
import NewsDetailPage from "@/components/pages/news-detail";

/**
 * /news/$slug — one dynamic route for every announcement in the
 * src/content/news registry. The detail page validates the slug
 * against the registry and renders the not-found state for unknown
 * slugs, so new announcements need no route changes.
 */
export const Route = createFileRoute("/news/$slug/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <NewsDetailPage slug={slug} />;
}

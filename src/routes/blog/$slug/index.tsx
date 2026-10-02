import { createFileRoute } from "@tanstack/react-router";
import BlogDetailPage from "@/components/pages/blog-detail";

/**
 * /blog/$slug — one dynamic route for every post in the
 * src/content/blog registry. The detail page validates the slug
 * against the registry and renders the not-found state for unknown
 * slugs, so new posts need no route changes.
 */
export const Route = createFileRoute("/blog/$slug/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <BlogDetailPage slug={slug} />;
}

import { createFileRoute } from "@tanstack/react-router";
import BlogPage from "@/components/pages/blog";

export const Route = createFileRoute("/blog/")({
  component: BlogPage,
});

import { createFileRoute } from "@tanstack/react-router";
import CareersPage from "@/components/pages/careers";

export const Route = createFileRoute("/careers/")({
  component: CareersPage,
});

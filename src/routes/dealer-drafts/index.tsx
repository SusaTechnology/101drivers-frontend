import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerDrafts = lazy(() => import('@/components/pages/dealer-drafts'))
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-drafts/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerDrafts />
    </Suspense>
  );
}

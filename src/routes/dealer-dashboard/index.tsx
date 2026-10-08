import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const DealerDashboard = lazy(() => import('@/components/pages/dealer-dashboard'))
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-dashboard/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <DealerDashboard />
    </Suspense>
  );
}

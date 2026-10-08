import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const ReviewDeliveryPage = lazy(() => import('@/components/pages/dealer-review-delivery'))
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-review-delivery/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <ReviewDeliveryPage />
    </Suspense>
  );
}

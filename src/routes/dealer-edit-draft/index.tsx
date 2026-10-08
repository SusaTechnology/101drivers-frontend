import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const EditDraftPage = lazy(() => import('@/components/pages/dealer-edit-draft'))
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-edit-draft/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Suspense fallback={<RoutePending />}>
      <EditDraftPage />
    </Suspense>
  );
}

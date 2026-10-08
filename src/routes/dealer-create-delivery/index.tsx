import { lazy, Suspense } from 'react'
import RoutePending from '@/components/shared/RoutePending'
const CreateDeliveryPage = lazy(() => import('@/components/pages/dealer-create-delivery'))
import { createFileRoute, useSearch } from "@tanstack/react-router";

export const Route = createFileRoute("/dealer-create-delivery/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      draftId: (search.draftId as string) || undefined,
    };
  },
});

function RouteComponent() {
  const { draftId } = useSearch({ from: "/dealer-create-delivery/" });
  return (
    <Suspense fallback={<RoutePending />}>
      <CreateDeliveryPage draftId={draftId} />
    </Suspense>
  );
}

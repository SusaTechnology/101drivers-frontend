// @ts-nocheck
import AdminServiceAreaPage from '@/components/pages/admin-service-area'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin-service-area/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AdminServiceAreaPage />
}

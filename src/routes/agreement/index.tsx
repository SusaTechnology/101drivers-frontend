import { createFileRoute } from '@tanstack/react-router'
import IndependentDriverAgreement from '@/components/pages/agreement'

export const Route = createFileRoute('/agreement/')({
  component: IndependentDriverAgreement,
})

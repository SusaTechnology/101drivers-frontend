import { createFileRoute } from '@tanstack/react-router'
import HelpPage from '@/components/pages/help'

export const Route = createFileRoute('/help-customer/')({
  component: () => <HelpPage type="customer" />,
})

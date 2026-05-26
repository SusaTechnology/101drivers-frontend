import { createFileRoute } from '@tanstack/react-router'
import HelpPage from '@/components/pages/help'

export const Route = createFileRoute('/help-driver/')({
  component: () => <HelpPage type="driver" />,
})

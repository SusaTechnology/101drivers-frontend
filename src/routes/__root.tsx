import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { PWAInstallPrompt } from '../components/pwa/PWAInstallPrompt'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <PWAInstallPrompt />
      <TanStackRouterDevtoolsPanel position="bottom-right" />
    </>
  ),
})

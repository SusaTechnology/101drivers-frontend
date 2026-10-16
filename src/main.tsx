//@ts-nocheck
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./styles.css";
import reportWebVitals from "./reportWebVitals.ts";
// import { ThemeProvider } from '@/lib/theme';
import { Providers, queryClient } from "./lib/tanstack/provider.tsx";
import {
  RouteErrorScreen,
  runStaleRecovery,
  clearStaleRecoveryLedger,
} from "./components/shared/RouteErrorScreen.tsx";
import { NotFoundScreen } from "./components/shared/NotFoundScreen.tsx";
import RoutePending from "./components/shared/RoutePending.tsx";
import { installErrorCapture } from "./lib/errorCapture.ts";

// Last-resort capture for errors that escape every layer above (event
// handlers, un-awaited promises, non-React code). Persists the last 20 to
// storage via safeStorage and — when VITE_CLIENT_LOG_URL is configured at
// build time — beacons them on tab hide/pagehide. Runs before the router
// mounts so even a crash during the first route import gets recorded.
installErrorCapture();
// import { GoogleMapsProvider } from "./lib/map/GoogleMapsProvider.tsx";
// Create a new router instance
const router = createRouter({
  routeTree,
  context: {queryClient},
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  // Replaces TanStack Router's bare-bones default crash screen (the white
  // page with a tiny icon users described as "the page goes blank and says
  // something") with a branded screen that offers recovery and auto-reloads
  // once when a deploy swaps out the JS chunks under an open tab.
  defaultErrorComponent: RouteErrorScreen,
  // While a route is pending (async work before it can render), show the
  // branded loading screen instead of leaving the old page frozen. The
  // 150ms grace avoids flashing the spinner for instant transitions.
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
  defaultPendingComponent: RoutePending,
  // Branded 404 — used by any route that triggers notFound() without
  // defining its own notFoundComponent (unmatched URLs render via the
  // root route's notFoundComponent, also NotFoundScreen).
  defaultNotFoundComponent: NotFoundScreen,
});

// Vite emits this event when a lazy chunk or its CSS preload fails — the
// typical case is a new deploy replacing hashed /assets files while a tab
// with the old build is open, or a corrupted lazy payload on a long-lived
// installed PWA. Recovery ESCALATES (see RouteErrorScreen): first failure
// gets the standard guarded soft reload; if the crash returns, a silent
// deep repair (unregister service worker + clear caches, sign-in kept);
// only a third failure ever reaches the actionable error card.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  runStaleRecovery();
});

// The device just booted into the app. If no stale crash re-appears within
// this stability window, the incident is over — clear the recovery ledger
// so the NEXT incident (days later) starts gently at the soft-reload step
// instead of jumping straight to the deep-repair level.
setTimeout(() => clearStaleRecoveryLedger(), 15_000);

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
// NOTE: the container holds a static boot shell (spinner + recovery
// buttons) so a failed bundle shows a branded screen instead of white.
// createRoot().render() replaces that content when React mounts — the
// old `!rootElement.innerHTML` guard here would have PERMANENTLY kept
// the shell on screen and never booted the app at all.
const rootElement = document.getElementById("app");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <>
   {/* <StrictMode>
       <ThemeProvider attribute="class" defaultTheme="light"> */}
        {/* <GoogleMapsProvider> */}
        <Providers>
          <RouterProvider router={router} />
        </Providers>
        {/* </GoogleMapsProvider> */}
      {/* </ThemeProvider> 
    </StrictMode>,*/}
    </>
  );
}

// Tell the index.html boot watchdogs that React took over — the shell
// (and its recovery buttons) can no longer appear on this page load.
(window as unknown as { __APP_BOOTED__?: boolean }).__APP_BOOTED__ = true;

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

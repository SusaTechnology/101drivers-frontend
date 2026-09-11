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
  reloadOnceForStaleBuild,
} from "./components/shared/RouteErrorScreen.tsx";
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
});

// Vite emits this event when a lazy chunk or its CSS preload fails — the
// typical case is a new deploy replacing hashed /assets files while a tab
// with the old build is open. One reload picks up the new build; the guard
// inside reloadOnceForStaleBuild() prevents infinite reload loops if the
// site is genuinely broken.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleBuild();
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

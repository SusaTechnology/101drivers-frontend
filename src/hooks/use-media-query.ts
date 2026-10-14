import { useSyncExternalStore } from "react";

/**
 * Reactive media query with a correct FIRST render.
 *
 * useSyncExternalStore reads the current match during render (unlike the
 * effect+setState pattern), so a desktop visitor gets the split layout on
 * the very first paint — no stacked→split flash, no remount churn. The
 * server snapshot reports `false`, which keeps react-snap prerendering on
 * the safe stacked layout when no real viewport exists.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

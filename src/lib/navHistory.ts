// lib/navHistory.ts
//
// In-app route memory for the admin navbar's Back button.
//
// Why not just window.history.back()? Because "back" must behave even when
// the browser history is not useful (fresh tab straight into a deep admin
// page, a reload that reset the context, an embed) — and because we want to
// SHOW where back will take you. This module keeps a small stack of the
// admin routes the user actually visited, in order, and answers one
// question: "what was the page before this one?"
//
// The stack lives at module scope, so it survives the Navbar remounting on
// every page change (each admin page renders its own <Navbar/>).

const MAX_ENTRIES = 50;

const stack: string[] = [];
let lastTracked = '';

/**
 * Record a navigation. Called from the navbar on every pathname change.
 * Mirrors real movement: pushing the page you're already on is a no-op, and
 * navigating to the entry right below the top (back button, browser back)
 * POPS instead of pushing, so the stack keeps matching reality.
 */
export function trackAdminPath(pathname: string): void {
  if (!pathname) return;
  if (pathname === lastTracked) return; // re-render on the same route

  if (stack.length >= 2 && stack[stack.length - 2] === pathname) {
    stack.pop(); // went back one step — un-pin the page we left
  } else {
    stack.push(pathname);
    if (stack.length > MAX_ENTRIES) stack.shift();
  }
  lastTracked = pathname;
}

/**
 * The page the user was on immediately before the current one, or null when
 * there is nothing in-app to go back to (first page of the session, reload,
 * fresh tab). Query strings are ignored — only the path matters.
 */
export function previousAdminPath(currentPathname: string): string | null {
  if (stack.length < 2) return null;
  const prev = stack[stack.length - 2];
  if (!prev || prev === currentPathname) return null;
  return prev;
}

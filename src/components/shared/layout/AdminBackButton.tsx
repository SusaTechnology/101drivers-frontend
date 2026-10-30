// components/shared/layout/AdminBackButton.tsx
//
// THE admin back button — one component, used by the shared Navbar (right
// hemisphere of every admin page) and by legacy pages that still render
// their own header (admin-notification-policy). Wherever it appears it
// looks and behaves identically: an icon-only round button that takes you
// back to the page you actually came from.
//
// Back order:
//   1. in-app route memory (lib/navHistory — the trail of admin pages this
//      session actually visited),
//   2. window.history.back() when the in-app trail was wiped (reload),
//   3. /admin-dashboard as a last resort.
//
// It also does the route tracking itself (guarded against double-pushes by
// navHistory), so a page that renders ONLY this button — no shared Navbar —
// is still tracked.

import { useCallback, useEffect } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { trackAdminPath, previousAdminPath } from '@/lib/navHistory';

export function AdminBackButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    trackAdminPath(pathname);
  }, [pathname]);

  const prevPath = previousAdminPath(pathname);
  // In-app memory first; the browser session history is the fallback
  // (covers a reload that wiped the in-app stack).
  const canGoBack =
    prevPath !== null ||
    (typeof window !== 'undefined' && window.history.length > 1);

  const handleBack = useCallback(() => {
    const prev = previousAdminPath(pathname);
    if (prev) {
      router.history.push(prev); // in-app: exactly the page before this one
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back(); // reload case: the browser remembers
      return;
    }
    router.history.push('/admin-dashboard'); // last resort: admin home
  }, [pathname, router]);

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('w-11 h-11 rounded-2xl shrink-0', className)}
      onClick={handleBack}
      disabled={!canGoBack}
      aria-label="Go back to the previous page"
      title={prevPath ? `Back to ${prevPath}` : 'Back'}
    >
      <ChevronLeft className="w-5 h-5 text-primary" />
    </Button>
  );
}

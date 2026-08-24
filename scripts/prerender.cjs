/**
 * Postbuild prerender script — uses react-snap to generate static HTML
 * for public, content-heavy routes.
 *
 * WHAT IT DOES:
 *   1. Spins up a headless Chromium (via Puppeteer, bundled with react-snap)
 *   2. Navigates to each route listed below
 *   3. Waits for the SPA to render
 *   4. Saves the fully-rendered HTML to dist/<route>/index.html
 *
 * WHY ONLY THESE ROUTES:
 *   - /home is excluded because it has a beforeLoad auth-redirect hook.
 *     If we prerendered it as logged-out HTML, authenticated users would
 *     see a flash of the home page before being redirected to their
 *     dashboard. Bad UX.
 *   - All admin/driver/dealer routes are excluded (auth-gated, no SEO value).
 *   - /track/$token is excluded (dynamic per-delivery, token in URL).
 *
 * UX CONSIDERATIONS:
 *   - Theme flash: users with dark mode saved in localStorage will see
 *     a brief light-mode flash before the app hydrates. Acceptable for
 *     the content pages being prerendered.
 *   - Hydration: React hydrates (doesn't re-render) on top of the
 *     prerendered HTML. No double-paint, no layout shift.
 *   - Links: react-snap rewrites <a href> to use the prerendered files
 *     where available, falling back to SPA routing for dynamic routes.
 *
 * ROLLBACK: if this script causes any issues, just remove the
 * "postbuild" line from package.json. The build will produce the
 * normal SPA dist/ without prerendered HTML.
 */

const { run } = require('react-snap');
const path = require('path');
const fs = require('fs');

const PUBLIC_STATIC_ROUTES = [
  '/about',
  '/privacy',
  '/terms',
  '/help-customer',
  '/help-driver',
  '/driver-onboarding',
];

// Find a working Chrome/Chromium binary. react-snap's bundled Puppeteer
// may be missing system libraries (libXtst.so.6 etc.). Fall back to
// system Puppeteer / Playwright browsers if available.
function findChrome() {
  const candidates = [
    // Newer Puppeteer (v22+) browser cache
    '/home/z/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome',
    // Playwright cache
    '/home/z/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
    // agent-browser cache
    '/home/z/.agent-browser/browsers/chrome-151.0.7922.34/chrome',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // let react-snap use its own bundled Chromium
}

run({
  // react-snap's sourceDir defaults to 'build' — Vite uses 'dist'.
  source: 'dist',
  destination: 'dist',

  // Use a working Chrome binary if the bundled one is broken
  // (missing system libraries)
  puppeteerExecutablePath: findChrome(),

  // Only prerender the routes listed above — NOT / or /home.
  include: PUBLIC_STATIC_ROUTES,

  // Don't crawl links from the prerendered pages
  crawl: false,

  // Use a port that doesn't conflict with dev server (3000) or preview (4173)
  port: 45678,

  // Skip external resources we can't control (Google Maps, Stripe, etc.)
  skipThirdPartyRequests: true,

  // Preload images found in the prerendered HTML.
  preloadImages: true,

  // Save as .html files (e.g. dist/about/index.html)
  saveAs: 'html',

  // Minify the output HTML (remove whitespace, comments)
  minifyHtml: {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
  },
})
  .then(() => {
    console.log('\n✅ Prerendered static HTML for:');
    PUBLIC_STATIC_ROUTES.forEach((route) => {
      console.log(`   dist${route === '/' ? '' : route}/index.html`);
    });
    console.log('\nThese pages now serve fully-rendered HTML to crawlers.');
    console.log('Dynamic routes (/home, /admin-*, /driver/*, etc.) remain SPA-rendered.\n');
  })
  .catch((err) => {
    console.error('\n❌ Prerendering failed:', err?.message || err);
    console.error('\nThe build still succeeded — you just don\'t have prerendered HTML.');
    console.error('To debug: run "node scripts/prerender.cjs" manually.\n');
    // Don't fail the build — the SPA still works, just without prerendering
    process.exit(0);
  });

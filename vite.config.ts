import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Stamp public/sw.js with a unique per-deploy build ID.
 *
 * The service worker names its cache buckets after this ID (see the
 * __BUILD_ID__ placeholder in public/sw.js). Every build therefore gets
 * its own bucket names, and the SW's activate handler wipes every bucket
 * from every previous deploy the first time it takes over — chunks from
 * old builds can never be served again. This closes the recurring
 * "stale/mixed chunks crash on long-lived devices (especially iOS PWA)"
 * failure mode: Vite reshuffles its chunks on every build, and a
 * hand-maintained cache version that never changes let devices mix
 * chunks from different deploy generations.
 *
 * Runs in closeBundle (after Vite copies public/ to dist/), so the
 * placeholder in the repo stays untouched for dev — and if this plugin
 * ever fails to run, the SW still works, it just keeps constant cache
 * names (degrades to the old behaviour, never breaks).
 */
function serviceWorkerBuildStamp(): Plugin {
  return {
    name: '101drivers:stamp-sw-build-id',
    apply: 'build',
    closeBundle() {
      try {
        const swPath = fileURLToPath(new URL('./dist/sw.js', import.meta.url))
        if (!fs.existsSync(swPath)) return

        // Compact UTC timestamp, e.g. "20261006102433" — unique per build.
        const buildId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)

        const content = fs.readFileSync(swPath, 'utf8')
        if (!content.includes('__BUILD_ID__')) return

        fs.writeFileSync(swPath, content.replaceAll('__BUILD_ID__', buildId))
        // eslint-disable-next-line no-console
        console.log(`[sw-stamp] dist/sw.js build ID: ${buildId}`)
      } catch (error) {
        // Never fail the build over the stamp — the SW tolerates the
        // unstamped placeholder at runtime.
        // eslint-disable-next-line no-console
        console.warn('[sw-stamp] failed to stamp dist/sw.js:', error)
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devtools(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    viteReact(),
    tailwindcss(),
    serviceWorkerBuildStamp(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Force all imports to use a single React instance
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
      'react-dom/client': path.resolve('./node_modules/react-dom/client'),
      'react/jsx-runtime': path.resolve('./node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve('./node_modules/react/jsx-dev-runtime'),
    },
    dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-is', '@tanstack/router-core'],
  },
  optimizeDeps: {
    // Force Vite to always re-bundle deps from scratch on server start.
    // Prevents stale cache from creating duplicate React instances
    // when code-split virtual modules (tsr-split) resolve to different
    // pre-bundled chunks after an HMR update or partial cache invalidation.
    force: true,
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-is',
      '@tanstack/react-router',
      '@tanstack/react-router-devtools',
      '@tanstack/react-devtools',
      '@tanstack/react-query',
      '@tanstack/router-core',
      '@react-google-maps/api',
      '@stripe/react-stripe-js',
    ],
  },
})

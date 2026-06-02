import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

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
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom', 'react-is', '@tanstack/router-core'],
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
    ],
  },
})

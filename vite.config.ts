import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

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

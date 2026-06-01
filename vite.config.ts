import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
// resolve.dedupe: tells Vite to always resolve these from project root.
// This prevents "Invalid hook call" / "older version of React" errors caused
// by libraries (recharts → react-is@18, radix-ui) resolving a different
// copy of React internals than the app itself during esbuild pre-bundling.
// See: https://vitejs.dev/config/shared-options.html#resolve-dedupe
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
    dedupe: [
      'react',
      'react-dom',
      'react-is',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-is', 'recharts', 'radix-ui', 'sonner'],
  },
})

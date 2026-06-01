import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

// https://vitejs.dev/config/
// "Invalid hook call" fix for Vite 7 + @tanstack/react-router autoCodeSplitting:
//
// PROBLEM: Vite pre-bundles react-dom into react-dom_client.js (hash A) while
// @tanstack/react-router (code-split into its own chunk) resolves react from
// a different pre-bundle pass (hash B). Two React module instances = useContext
// returns null inside router hooks (useRouter, useNavigate, etc).
//
// FIX: resolve.alias forces ALL react-family imports to the same physical
// files. optimizeDeps.include forces Vite to pre-bundle react, react-dom,
// and react-dom/client together in a SINGLE pass so they share one chunk hash.
//
// After changing this file, ALWAYS delete node_modules/.vite and restart.
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
    dedupe: ['react', 'react-dom', 'react-is'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),

      // Force ALL react imports → project's own copies, no matter who imports
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      'react-is': path.resolve(__dirname, 'node_modules/react-is'),
    },
  },
  optimizeDeps: {
    // Force react + react-dom + sub-paths into the SAME pre-bundle pass
    // so they all get the same hash (no react-dom_client.js vs chunk split)
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-is',
    ],
  },
})

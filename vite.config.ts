import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
//
// "Invalid hook call" fix for Vite 7 + @tanstack/react-router autoCodeSplitting:
//
// ROOT CAUSE: resolve.alias entries for react/react-dom defeat Vite's dep
// optimization. When the alias resolves "import React from 'react'" to an
// absolute path like "/abs/node_modules/react", Vite no longer recognises it
// as a pre-bundled dependency and serves the RAW CJS source instead. That raw
// source is a separate module instance with its own ReactSharedInternals
// object (where the dispatcher H is null), while the pre-bundled react-dom
// chunk sets the dispatcher on ITS copy. Result: two ReactSharedInternals
// objects → hooks return null → "Invalid hook call".
//
// FIX: Remove all react-family aliases. Let Vite resolve bare specifiers
// ("react", "react-dom/client") naturally so the dep optimizer can redirect
// them to the shared pre-bundle. The dedupe flag tells Rollup to
// de-duplicate react module entries inside code-split chunks produced by
// @tanstack/router-plugin.
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
    },
  },
  optimizeDeps: {
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

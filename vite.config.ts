import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

// https://vitejs.dev/config/
// The "Invalid hook call" error is caused by Vite pre-bundling react/react-dom
// into a separate optimized chunk (react-dom_client.js) while code-split
// route chunks (@tanstack/react-router with autoCodeSplitting) resolve react
// from the raw source. Two different module sources = two React instances =
// useContext returns null.
//
// FIX: resolve.alias forces ALL react imports to project's own copies.
// optimizeDeps.exclude prevents Vite from creating a separate pre-bundled
// react-dom_client.js chunk. Result: every chunk resolves the same React.
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

      // Force ALL react imports → project's own react, no matter who imports
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      'react-is': path.resolve(__dirname, 'node_modules/react-is'),
    },
  },
  optimizeDeps: {
    // Exclude react family from pre-bundling — serve raw so all chunks
    // resolve the exact same module instance (no react-dom_client.js split)
    exclude: ['react', 'react-dom', 'react-is'],
  },
})

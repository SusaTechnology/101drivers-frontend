import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

// https://vitejs.dev/config/
// resolve.dedupe: tells Vite to always resolve these from project root.
// resolve.alias: forces react/react-dom/react-is to ALWAYS point to the
// project's own copies — even when libraries (like @stripe/react-stripe-js
// using CJS require('react'), recharts pulling react-is@18) try to import
// from a different location. This eliminates the "Invalid hook call" /
// "older version of React" error caused by dual React instances.
//
// IMPORTANT: after changing this file, delete node_modules/.vite and restart.
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

      // Force ALL react imports → project's own react, no matter who imports
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      'react-is': path.resolve(__dirname, 'node_modules/react-is'),
    },
  },
  optimizeDeps: {
    // Force Vite to pre-bundle these together so they share one React instance
    include: [
      'react',
      'react-dom',
      'react-is',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'recharts > d3-scale',
      'recharts > react-is',
      'radix-ui',
      'sonner',
      '@stripe/react-stripe-js',
    ],
  },
})

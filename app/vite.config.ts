import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // brand.json lives at the repository root, shared with the customer site.
  server: { fs: { allow: ['..'] } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true },
      manifest: {
        name: 'Kitchen Manager',
        short_name: 'Kitchen',
        description: 'Orders, stock and profit for our food business',
        theme_color: '#ea580c',
        background_color: '#fff7ed',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
      },
      workbox: {
        navigateFallback: '/index.html',
        // Adds push notification handling to the generated service worker.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})

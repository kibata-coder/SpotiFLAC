import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Take control immediately on install — no waiting for old tab to close
        skipWaiting: true,
        clientsClaim: true,
        // Cache all app shell assets (JS, CSS, HTML, images, fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never cache API calls — always hit the network for fresh data
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'SoudMusic',
        short_name: 'SoudMusic',
        description: 'Search and play music offline',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Ensure we build standard web assets into the "dist" folder
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  }
});

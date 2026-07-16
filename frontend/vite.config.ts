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
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'SpotiFLAC',
        short_name: 'SpotiFLAC',
        description: 'Offline capable music player',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
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
  // Optional: Clean up standard development server settings
  server: {
    port: 3000,
    strictPort: true,
    host: true, // Allow connections from network IPs (mobile)
    proxy: {
      '/api': {
        target: 'https://web-production-9dcae.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});

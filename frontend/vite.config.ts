import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  }
});

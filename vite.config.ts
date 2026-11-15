/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiPlugin } from './server/viteApi';

export default defineConfig({
  // apiPlugin serves the /api functions locally, the same files Vercel deploys.
  plugins: [react(), tailwindcss(), apiPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // pdfjs-dist 4.x ships top-level await, which needs an ES2022 target.
    target: 'es2022',
    // The job screens are lazy loaded. The largest chunk left is exceljs (about 940 kB,
    // pre-minified by its authors), fetched only when someone exports to Excel.
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
    // Pre-bundle the lazily loaded libraries at server start. Otherwise the dev server
    // discovers them on first use (e.g. the first Excel export) and reloads the page mid-demo.
    include: ['exceljs', 'pdfjs-dist', 'pdf-lib'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
});

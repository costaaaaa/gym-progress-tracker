import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    // In produzione i console.* (log di debug, ma anche console.error) non finiscono nel bundle
    rolldownOptions: {
      output: { minify: { compress: { dropConsole: true } } },
    },
    chunkSizeWarningLimit: 1000,
  },
});

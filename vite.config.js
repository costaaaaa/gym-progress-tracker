import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/gym-progress-tracker-v2/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1000,
  },
});

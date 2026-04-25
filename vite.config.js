import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [react(), svgr()],
  base: '/gym-progress-tracker-v2/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('@mui/x-date-pickers') || id.includes('date-fns')) {
              return 'vendor-date-pickers';
            }
            if (id.includes('@mui/')) {
              return 'vendor-mui';
            }
          }
        },
      },
    },
  },
});

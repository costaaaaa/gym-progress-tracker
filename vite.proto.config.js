// PROTOTIPO (da buttare). Solo per questo ambiente: il dev server di Vite 8 qui fallisce nell'ottimizzare emotion, quindi build + preview con DEV forzato
import { mergeConfig } from 'vite';
import base from './vite.config.js';
export default mergeConfig(base, {
  define: { 'import.meta.env.DEV': 'true' },
  server: { open: false },
});

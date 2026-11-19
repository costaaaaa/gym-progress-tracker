// PROTOTIPO (da buttare): build dedicata con import.meta.env.DEV forzato, perché il dev server di Vite qui non parte.
// Il plugin della landing inglese (scrive build/en) non serve al prototipo e cerca la cartella build/: lo escludiamo.
import { mergeConfig } from 'vite';
import base from './vite.config.js';
export default mergeConfig({ ...base, plugins: base.plugins.filter((p) => p.name !== 'liftindex-english-landing') }, {
  define: { 'import.meta.env.DEV': 'true' },
  build: { outDir: '/tmp/work/proto-redesign-build', emptyOutDir: true },
  server: { open: false },
});

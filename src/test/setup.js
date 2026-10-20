import { beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../i18n';

// I test cercano i testi italiani: la lingua è fissata qui, non dipende da come l'app sceglie la prima
beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom non ha matchMedia: lo usano MUI (useMediaQuery) e utils/celebrate
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));

// Neanche ResizeObserver: lo usa il ResponsiveContainer di Recharts
window.ResizeObserver = window.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

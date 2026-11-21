// Aiuti per i test dei blocchi della Home: il blocco dentro un router e un tema, e un fetch finto che risponde per
// parte dell'indirizzo. Un valore `{ status: 500 }` fa fallire la richiesta, una funzione dà la risposta al momento.
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeModeProvider } from '../context/ThemeModeContext';

const Where = () => <p data-testid="where">{useLocation().pathname}{useLocation().search}</p>;

export const renderBlock = (element) => render(
  <MemoryRouter>
    <ThemeModeProvider>
      <Routes>
        <Route path="/" element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </ThemeModeProvider>
  </MemoryRouter>,
);

const reply = (body) => {
  if (body?.status === 500) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
};

// `responses`: { 'parte/dell/indirizzo': corpo | { status: 500 } | (url) => corpo }
export const stubFetch = (responses) => {
  const fake = vi.fn((url) => {
    const key = Object.keys(responses).find((k) => String(url).includes(k));
    if (!key) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    const body = responses[key];
    return reply(typeof body === 'function' ? body(url) : body);
  });
  vi.stubGlobal('fetch', fake);
  return fake;
};

export const reducedMotion = (reduce) => {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') && reduce, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
};

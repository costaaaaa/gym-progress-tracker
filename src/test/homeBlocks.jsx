// Aiuti per i test dei blocchi della Home: il blocco dentro un router e un tema, e un fetch finto che risponde per
// parte dell'indirizzo. Un valore `{ status: 500 }` fa fallire la richiesta, una funzione dà la risposta al momento.
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json } from './dom';

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

// `responses`: { 'parte/dell/indirizzo': corpo | { status: 500 } | (url) => corpo }
export const stubFetch = (responses) => {
  const fake = vi.fn((url) => {
    const key = Object.keys(responses).find((k) => String(url).includes(k));
    if (!key) return Promise.resolve(json({}, 404));
    const body = typeof responses[key] === 'function' ? responses[key](url) : responses[key];
    return Promise.resolve(body?.status === 500 ? json({}, 500) : json(body));
  });
  vi.stubGlobal('fetch', fake);
  return fake;
};

export const reducedMotion = (reduce) => {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') && reduce, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
};

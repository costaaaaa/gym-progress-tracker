// Apertura rossa della Home: la pagina lo dice al Layout con il contesto dell'Outlet; sul telefono dentro l'app la barra
// in alto diventa rossa e il campo arriva ai bordi, uscendo dalla pagina tutto torna neutro.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, useOutletContext } from 'react-router-dom';
import Layout from './Layout';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { mediaStyle } from '../../test/mediaStyle';

const auth = vi.hoisted(() => ({ value: { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false, emailState: null } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const realMatchMedia = window.matchMedia;
const phoneMedia = (query) => ({ matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

const RedPage = () => {
  const { setBarRed } = useOutletContext();
  useEffect(() => {
    setBarRed(true);
    return () => setBarRed(false);
  }, [setBarRed]);
  return <><h1>Home finta</h1><Link to="/altra">altra pagina</Link></>;
};
const OtherPage = () => <h1>Altra pagina</h1>;

const mount = () => render(
  <MemoryRouter initialEntries={['/']}>
    <ThemeModeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RedPage />} />
          <Route path="/altra" element={<OtherPage />} />
        </Route>
      </Routes>
    </ThemeModeProvider>
  </MemoryRouter>,
);
const barColor = () => getComputedStyle(document.querySelector('header')).backgroundColor;
const RED = 'rgb(213, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';

beforeEach(() => { window.matchMedia = phoneMedia; });
afterEach(() => {
  window.matchMedia = realMatchMedia;
  auth.value = { user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false, emailState: null };
});

describe('Layout con l\'apertura rossa', () => {
  it('sul telefono la barra in alto è rossa finché la pagina lo chiede', () => {
    mount();
    expect(barColor()).toBe(RED);
  });

  it('uscendo dalla pagina (anche con il tasto indietro) la barra torna neutra', () => {
    mount();
    fireEvent.click(screen.getByRole('link', { name: 'altra pagina' }));
    expect(screen.getByRole('heading', { name: 'Altra pagina' })).toBeTruthy();
    expect(barColor()).toBe(WHITE);
  });

  it('il campo arriva ai bordi: il contenitore perde margine in alto e bordi laterali sotto md, e li ha da md in su', () => {
    mount();
    const main = screen.getByRole('main');
    expect(mediaStyle(main, 0)['margin-top']).toBe('0px');
    expect(mediaStyle(main, 0)['padding-left']).toBe('0px');
    expect(mediaStyle(main, 0)['padding-right']).toBe('0px');
    expect(mediaStyle(main, 900)['margin-top']).toBe('32px');
    expect(mediaStyle(main, 900)['padding-left']).toBe('32px');
  });

  it('senza lo stato rosso il contenitore ha i margini di sempre', () => {
    mount();
    fireEvent.click(screen.getByRole('link', { name: 'altra pagina' }));
    const main = screen.getByRole('main');
    expect(mediaStyle(main)['margin-top']).toBe('32px');
    expect(mediaStyle(main, 0)['padding-left']).toBe('16px');
  });

  it('per chi non è loggato la barra non diventa rossa', () => {
    auth.value = { user: null, isLoggedIn: false, loading: false };
    mount();
    expect(barColor()).toBe(WHITE);
  });
});

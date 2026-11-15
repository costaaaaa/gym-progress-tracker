// «Salta al contenuto» (2.4.1): primo elemento raggiungibile con Tab, visibile solo col focus, porta al <main>
// senza cambiare rotta.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './Layout';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import i18n from '../../i18n';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: false }),
}));

const Page = () => {
  const { pathname, hash } = useLocation();
  return <h1 data-testid="where">{pathname + hash}</h1>;
};

const mount = () => render(
  <MemoryRouter initialEntries={['/pagina']}>
    <ThemeModeProvider>
      <Routes><Route element={<Layout />}><Route path="/pagina" element={<Page />} /></Route></Routes>
    </ThemeModeProvider>
  </MemoryRouter>,
);

describe('salta al contenuto', () => {
  it('è il primo link della pagina e punta al <main>', () => {
    mount();
    const skip = screen.getByRole('link', { name: 'Salta al contenuto' });
    expect(document.querySelector('a, button')).toBe(skip);
    const main = screen.getByRole('main');
    expect(skip.getAttribute('href')).toBe(`#${main.id}`);
    expect(main.id).not.toBe('');
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('in inglese il testo è «Skip to main content»', async () => {
    await act(() => i18n.changeLanguage('en'));
    mount();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeTruthy();
  });

  it('con un clic o Invio il focus va al <main> e la rotta non cambia', () => {
    mount();
    const skip = screen.getByRole('link', { name: 'Salta al contenuto' });
    const notPrevented = fireEvent.click(skip);
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(screen.getByTestId('where').textContent).toBe('/pagina');
    expect(window.location.hash).toBe('');
  });

  it('sta fuori dallo schermo finché non ha il focus', () => {
    mount();
    const skip = screen.getByRole('link', { name: 'Salta al contenuto' });
    const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
    const hidden = rules.find((r) => skip.classList.contains(r.selectorText?.slice(1)) && r.style?.transform);
    const shown = rules.find((r) => r.selectorText && r.selectorText.endsWith(':focus') && skip.classList.contains(r.selectorText.slice(1, -6)));
    expect(hidden.style.transform).toMatch(/translateY\(-/);
    expect(shown.style.transform).toBe('none');
  });
});

// Piè di pagina degli ospiti: calcolatore 1RM e guida MCP sono pagine PHP, quindi link normali (non del router)
// e nella lingua corrente.
describe('piè di pagina: link al blog', () => {
  const links = () => {
    const footer = screen.getByRole('contentinfo');
    return [...footer.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
  };

  it('in italiano', async () => {
    await act(() => i18n.changeLanguage('it'));
    mount();
    expect(links()).toEqual(expect.arrayContaining([
      ['Calcolatore 1RM', '/blog/calcolatore-1rm/'],
      ['Collega il tuo assistente AI', '/blog/mcp/'],
    ]));
  });

  it('in inglese', async () => {
    await act(() => i18n.changeLanguage('en'));
    mount();
    expect(links()).toEqual(expect.arrayContaining([
      ['1RM calculator', '/en/blog/1rm-calculator/'],
      ['Connect your AI assistant', '/en/blog/mcp/'],
    ]));
  });
});

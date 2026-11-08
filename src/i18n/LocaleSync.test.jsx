// Da loggati le pagine /en/ portano a quelle senza prefisso; login e registrazione portano
// alla pagina del ?next=, la stessa a cui va il login appena fatto.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LocaleSync from './LocaleSync';
import i18n, { getLanguageChoice } from './index';

const auth = vi.hoisted(() => ({ user: { locale: 'en' }, loading: false }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const Where = () => {
  const { pathname, search, hash } = useLocation();
  return <p>{pathname + search + hash}</p>;
};

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleSync />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('LocaleSync da loggati', () => {
  beforeEach(() => {
    auth.user = { locale: 'en' };
    localStorage.clear();
  });

  it('porta una pagina /en/ a quella senza prefisso', async () => {
    renderAt('/en/forgot-password?x=1');
    expect(await screen.findByText('/forgot-password?x=1')).toBeTruthy();
  });

  it.each([
    ['/en/login?next=%2Fprofilo%3Ftab%3Dsettings', '/profilo?tab=settings'],
    ['/en/register?next=%2Fgruppi', '/gruppi'],
    ['/en/login', '/'],
  ])('da %s porta alla pagina del next', async (path, target) => {
    renderAt(path);
    expect(await screen.findByText(target)).toBeTruthy();
  });

  it('account in italiano su /en/login: pagina del next con l\'ancora, lingua e scelta italiane', async () => {
    auth.user = { locale: 'it' };
    renderAt('/en/login?next=%2Fprofilo%3Ftab%3Dsettings%23sezione');
    expect(await screen.findByText('/profilo?tab=settings#sezione')).toBeTruthy();
    expect(getLanguageChoice()).toBe('it');
    expect(i18n.language).toBe('it');
  });
});

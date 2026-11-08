// Da loggati le pagine /en/ portano a quelle senza prefisso; login e registrazione portano
// alla pagina del ?next=, la stessa a cui va il login appena fatto.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LocaleSync from './LocaleSync';

vi.mock('../context/AuthContext', () => {
  const auth = { user: { locale: 'en' }, loading: false };
  return { useAuth: () => auth };
});

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
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
});

// Da loggati le pagine /en/ portano a quelle senza prefisso, tranne login e registrazione:
// lì il login appena fatto porta già alla pagina del ?next=.
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

  it.each(['/en/login?next=%2Fprofilo', '/en/register?next=%2Fgruppi'])('resta su %s', async (path) => {
    renderAt(path);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId('where').textContent).toBe(path);
  });
});

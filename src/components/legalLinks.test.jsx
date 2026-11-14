// Informativa privacy e termini: i link dei componenti puntano alla pagina nella lingua dell'interfaccia.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../i18n';
import Layout from './Layout/Layout';
import ShareConsentDialog from './Groups/ShareConsentDialog';
import HealthConsentCard from './HealthConsentCard';

vi.mock('../context/AuthContext', () => {
  const auth = { isLoggedIn: false, loading: false };
  return { useAuth: () => auth };
});
vi.mock('./Layout/Navbar', () => ({ default: () => null }));
vi.mock('./Layout/BottomNav', () => ({ default: () => null }));
vi.mock('./Layout/LanguageHint', () => ({ default: () => null }));
vi.mock('../utils/consent', () => ({ setConsent: () => Promise.resolve() }));

const CASES = [
  ['it', '/privacy.html', '/termini.html'],
  ['en', '/en/privacy.html', '/en/terms.html'],
];

describe.each(CASES)('link legali in %s', (lang, privacy, terms) => {
  it('piè di pagina', async () => {
    await i18n.changeLanguage(lang);
    render(
      <MemoryRouter>
        <Routes><Route element={<Layout />}><Route index element={<p>pagina</p>} /></Route></Routes>
      </MemoryRouter>,
    );
    const footer = screen.getByRole('contentinfo');
    const hrefs = [...footer.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain(privacy);
    expect(hrefs).toContain(terms);
  });

  it('consenso all\'ingresso in un gruppo', async () => {
    await i18n.changeLanguage(lang);
    render(<ShareConsentDialog open groupName="G" username="u" loading={false} onClose={() => {}} onConfirm={() => {}} />);
    const links = [...document.querySelectorAll('a[href$=".html"]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([privacy]);
  });

  it('consenso alle misure corporee', async () => {
    await i18n.changeLanguage(lang);
    render(<HealthConsentCard onGranted={() => {}} />);
    const links = [...document.querySelectorAll('a[href$=".html"]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([privacy]);
  });
});

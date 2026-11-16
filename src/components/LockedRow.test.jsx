// Riga con lucchetto: cosa si sblocca, etichetta "Plus" e link a pagina intera verso i piani.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LockedRow from './LockedRow';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import i18n from '../i18n';
import { plansPath } from '../i18n/paths';

const mount = () => render(<ThemeModeProvider><LockedRow>Percentuale di recupero e giorni mancanti</LockedRow></ThemeModeProvider>);

beforeEach(async () => {
  localStorage.setItem('themeMode', 'light');
  await i18n.changeLanguage('it');
});

describe('riga con lucchetto', () => {
  it('dice cosa si sblocca, con l\'etichetta Plus, e rimanda ai piani', () => {
    mount();
    expect(screen.getByText('Percentuale di recupero e giorni mancanti')).toBeTruthy();
    expect(screen.getByText('Plus')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Confronta i piani' }).getAttribute('href')).toBe('/piani');
  });

  it('il lucchetto è decorativo e il link ha un bersaglio di almeno 44 px', () => {
    mount();
    expect(screen.getByTestId('LockOutlinedIcon').getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(screen.getByRole('link')).minHeight).toBe('44px');
  });

  it('in inglese il link va a /en/plans e il testo è in inglese', async () => {
    await i18n.changeLanguage('en');
    mount();
    expect(screen.getByRole('link', { name: 'Compare plans' }).getAttribute('href')).toBe('/en/plans');
  });

  it('plansPath dà il percorso nella lingua', () => {
    expect(plansPath('it')).toBe('/piani');
    expect(plansPath('en')).toBe('/en/plans');
  });
});

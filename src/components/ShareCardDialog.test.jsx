// Card da condividere: il dialogo ha un titolo che lo nomina e l'anteprima sul canvas ha un testo alternativo
// che riporta ciò che la card mostra. Il disegno vero non gira in jsdom: si prova solo il testo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import i18n from '../i18n';
import ShareCardDialog from './ShareCardDialog';
import { buildShareStats } from '../utils/shareCard';
import { setBrowserTimeZone } from '../test/timeZone';

vi.mock('../utils/analytics', () => ({ track: vi.fn() }));
vi.mock('../utils/renderShareCard', () => ({
  loadCardFonts: () => Promise.resolve(),
  renderCardToCanvas: () => {},
  canvasToPngFile: () => Promise.resolve(null),
  loadPhoto: () => Promise.resolve(null),
}));

const stats = () => buildShareStats({
  exercises: [{ name: 'Panca piana', muscle_group: 'petto', sets: [{ weight: 80, reps: 5 }, { weight: 80, reps: 5 }] }],
  date: '2026-10-18 10:00:00', durationSec: 3600, title: 'Petto', records: [],
});

beforeEach(() => setBrowserTimeZone('Europe/Rome'));

const mount = async () => {
  render(<ShareCardDialog open onClose={() => {}} stats={stats()} />);
  await act(async () => {});
};

describe('nomi accessibili', () => {
  it('il dialogo si chiama come il suo titolo', async () => {
    await mount();
    expect(screen.getByRole('dialog', { name: 'Condividi' })).toBeTruthy();
  });

  it('l\'anteprima è un\'immagine che dice cosa riporta la card', async () => {
    await mount();
    const card = screen.getByRole('img', { name: /Anteprima della card/ });
    expect(card.tagName).toBe('CANVAS');
    ['DOMENICA 18 OTTOBRE', 'Petto', '1h 00m', '\\b2\\W+SERIE', '800 kg'].forEach((text) => {
      expect(screen.getByRole('img', { name: new RegExp(text) })).toBe(card);
    });
  });

  it('cambiando lingua a dialogo aperto il testo dell\'anteprima segue la lingua', async () => {
    await mount();
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      expect(screen.getByRole('img', { name: /OCTOBER/i })).toBeTruthy();
      expect(screen.queryByRole('img', { name: /OTTOBRE/i })).toBeNull();
    } finally {
      await act(async () => { await i18n.changeLanguage('it'); });
    }
  });
});

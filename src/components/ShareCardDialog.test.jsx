// Card da condividere: il dialogo ha un titolo che lo nomina e l'anteprima sul canvas ha un testo alternativo
// che riporta ciò che la card mostra. Il disegno vero non gira in jsdom: si prova solo il testo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import i18n from '../i18n';
import ShareCardDialog from './ShareCardDialog';
import { buildShareStats } from '../utils/shareCard';
import { setBrowserTimeZone } from '../test/timeZone';
import { renderCardToCanvas, loadPhoto } from '../utils/renderShareCard';

vi.mock('../utils/analytics', () => ({ track: vi.fn() }));
vi.mock('../utils/renderShareCard', () => ({
  loadCardFonts: () => Promise.resolve(),
  renderCardToCanvas: vi.fn(),
  canvasToPngFile: () => Promise.resolve(null),
  loadPhoto: vi.fn(() => Promise.resolve(null)),
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

// 2.1.1: la foto si sposta anche da tastiera. L'anteprima resta un'immagine; la superficie da trascinare
// è un elemento a parte, raggiungibile con Tab, che non intercetta il puntatore.
describe('foto: spostamento da tastiera', () => {
  const lastTransform = () => renderCardToCanvas.mock.calls.at(-1)[3];
  // Foto larga per default; (1000, 3000) è alta
  const withPhoto = async (width = 3000, height = 1000) => {
    loadPhoto.mockResolvedValue({ width, height });
    await mount();
    const input = document.querySelector('input[type="file"]');
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] } }); });
    return screen.getByRole('application', { name: 'Posizione della foto' });
  };

  it('senza foto non c\'è nessuna superficie da spostare', async () => {
    await mount();
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('con la foto la superficie è raggiungibile con Tab, ha nome e descrizione, e l\'anteprima resta un\'immagine', async () => {
    const surface = await withPhoto();
    expect(surface.tabIndex).toBe(0);
    expect(surface.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(surface.getAttribute('aria-describedby')).textContent).toMatch(/frecce/i);
    expect(screen.getByRole('img', { name: /Anteprima della card/ }).tagName).toBe('CANVAS');
  });

  it('le frecce spostano la foto, Maiusc di più, e si ferma agli stessi limiti del trascinamento', async () => {
    const surface = await withPhoto();
    const x0 = lastTransform().dx;
    fireEvent.keyDown(surface, { key: 'ArrowLeft' });
    const piccolo = x0 - lastTransform().dx;
    expect(piccolo).toBeGreaterThan(0);
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(lastTransform().dx).toBeCloseTo(x0);
    fireEvent.keyDown(surface, { key: 'ArrowLeft', shiftKey: true });
    expect(x0 - lastTransform().dx).toBeGreaterThan(piccolo * 2);
    for (let i = 0; i < 200; i += 1) fireEvent.keyDown(surface, { key: 'ArrowLeft', shiftKey: true });
    const limite = lastTransform().dx;
    fireEvent.keyDown(surface, { key: 'ArrowLeft', shiftKey: true });
    expect(lastTransform().dx).toBe(limite);
    expect(limite).toBeLessThan(0);
  });

  it('su e giù muovono la foto in verticale', async () => {
    const surface = await withPhoto(1000, 3000);
    const y0 = lastTransform().dy;
    fireEvent.keyDown(surface, { key: 'ArrowDown' });
    expect(lastTransform().dy).toBeGreaterThan(y0);
    fireEvent.keyDown(surface, { key: 'ArrowUp' });
    expect(lastTransform().dy).toBeCloseTo(y0);
  });

  it('gli altri tasti non fanno nulla e la freccia non scorre la pagina', async () => {
    const surface = await withPhoto();
    const prima = lastTransform();
    fireEvent.keyDown(surface, { key: 'a' });
    expect(lastTransform()).toEqual(prima);
    expect(fireEvent.keyDown(surface, { key: 'ArrowLeft' })).toBe(false);
  });
});

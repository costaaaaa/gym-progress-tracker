// «Ultimo allenamento»: blocco piccolo, tutto cliccabile verso lo Storico.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import i18n from '../../i18n';
import { MemoryRouter } from 'react-router-dom';
import LastWorkout from './LastWorkout';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

const record = {
  date: '2026-11-18 18:30:00', day_name: 'Giorno A · Push', duration_seconds: 3480,
  exercises: [{ name: 'Panca', sets: [{ weight: 100, reps: 10 }] }],
};
const show = (props) => render(<MemoryRouter><ThemeModeProvider><LastWorkout record={record} weightUnit="kg" {...props} /></ThemeModeProvider></MemoryRouter>);

describe('Ultimo allenamento', () => {
  // Il test in inglese non deve lasciare la lingua cambiata agli altri, nemmeno se fallisce
  afterEach(() => act(() => i18n.changeLanguage('it')));

  it('etichetta, nome del giorno, data lunga, durata e volume; tutto il blocco porta allo Storico', () => {
    show();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/storico');
    expect(link.textContent).toContain('Ultimo allenamento');
    expect(link.textContent).toContain('Giorno A · Push');
    expect(link.textContent).toContain('Mercoledì 18 novembre 2026');
    expect(link.textContent).toContain('58 min · 1.000 kg di volume');
  });

  it('dell\'anno di oggi (quello del server) non mostra l\'anno; di un altro anno sì', () => {
    show({ today: '2026-11-19' });
    expect(screen.getByRole('link').textContent).toContain('Mercoledì 18 novembre');
    expect(screen.getByRole('link').textContent).not.toContain('2026');
    cleanup();
    show({ today: '2027-01-02' });
    expect(screen.getByRole('link').textContent).toContain('Mercoledì 18 novembre 2026');
  });

  it('in inglese: iniziale maiuscola e anno solo se diverso', async () => {
    await act(() => i18n.changeLanguage('en'));
    show({ today: '2026-11-19' });
    expect(screen.getByRole('link').textContent).toMatch(/Wednesday,? (18 November|November 18)(?!,? 2026)/);
    cleanup();
    show({ today: '2027-01-02' });
    expect(screen.getByRole('link').textContent).toMatch(/2026/);
  });

  it('senza nome del giorno (allenamento di prima) mostra solo data e riga', () => {
    show({ record: { ...record, day_name: null } });
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('Mercoledì 18 novembre 2026');
    expect(link.textContent).not.toContain('null');
  });

  it('senza durata né volume non c\'è la riga', () => {
    show({ record: { date: '2026-11-18 18:30:00', exercises: [] } });
    expect(screen.getByRole('link').textContent).not.toContain('min');
  });

  it('l\'etichetta è un\'intestazione di secondo livello', () => {
    show();
    expect(screen.getByRole('heading', { level: 2, name: 'Ultimo allenamento' })).toBeTruthy();
  });
});

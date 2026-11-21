// «Ultimo allenamento»: blocco piccolo, tutto cliccabile verso lo Storico.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LastWorkout from './LastWorkout';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

const record = {
  date: '2026-11-18 18:30:00', day_name: 'Giorno A · Push', duration_seconds: 3480,
  exercises: [{ name: 'Panca', sets: [{ weight: 100, reps: 10 }] }],
};
const show = (props) => render(<MemoryRouter><ThemeModeProvider><LastWorkout record={record} weightUnit="kg" {...props} /></ThemeModeProvider></MemoryRouter>);

describe('Ultimo allenamento', () => {
  it('etichetta, nome del giorno, data lunga, durata e volume; tutto il blocco porta allo Storico', () => {
    show();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/storico');
    expect(link.textContent).toContain('Ultimo allenamento');
    expect(link.textContent).toContain('Giorno A · Push');
    expect(link.textContent).toContain('mercoledì 18 novembre 2026');
    expect(link.textContent).toContain('58 min · 1000 kg di volume');
  });

  it('senza nome del giorno (allenamento di prima) mostra solo data e riga', () => {
    show({ record: { ...record, day_name: null } });
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('mercoledì 18 novembre 2026');
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

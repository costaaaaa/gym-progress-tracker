// Dialog «Modifica data»: l'avviso su Salute compare solo per gli allenamenti che il telefono ha scritto in Salute.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditWorkoutDateDialog from './EditWorkoutDateDialog';
import { json } from '../test/dom';
import { setBrowserTimeZone } from '../test/timeZone';

const AVVISO = 'Nell\'app Salute del telefono la data si aggiorna alla prossima apertura di LiftIndex.';
const workout = { id: 7, date: '2026-10-18 02:00:00' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: true }))));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const apri = (w) => render(<EditWorkoutDateDialog open onClose={() => {}} workout={w} onUpdateSuccess={() => {}} />);

describe('avviso su Salute', () => {
  it('compare se l\'allenamento è in Salute', () => {
    apri({ ...workout, health_written: true });
    expect(screen.getByText(AVVISO)).toBeTruthy();
  });

  it('non compare se l\'allenamento non è in Salute', () => {
    apri({ ...workout, health_written: false });
    expect(screen.queryByText(AVVISO)).toBeNull();
  });

  it('non compare se il server non manda il campo', () => {
    apri(workout);
    expect(screen.queryByText(AVVISO)).toBeNull();
  });
});

describe('spostamento della data', () => {
  const sposta = async (onUpdateSuccess, risposta) => {
    vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(JSON.parse(init?.body ?? '{}').preview ? json({ success: true }) : risposta)));
    render(<EditWorkoutDateDialog open onClose={() => {}} workout={workout} onUpdateSuccess={onUpdateSuccess} />);
    fireEvent.change(screen.getByLabelText('Nuova data'), { target: { value: '2026-10-19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  };

  it('a salvataggio riuscito passa giorno e ora scritti nella risposta, istante e fuso (non l\'ISO convertito)', async () => {
    const onUpdateSuccess = vi.fn();
    await sposta(onUpdateSuccess, json({
      success: true, new_date: '2026-10-19T02:00:00-04:00', started_at: '2026-10-19T02:00:00-04:00', time_zone: 'America/New_York',
    }));
    await waitFor(() => expect(onUpdateSuccess).toHaveBeenCalled());
    expect(onUpdateSuccess).toHaveBeenCalledWith(7, {
      date: '2026-10-19 02:00:00', started_at: '2026-10-19T02:00:00-04:00', time_zone: 'America/New_York',
    });
  });

  it('una data nel futuro rifiutata dal server mostra un messaggio chiaro', async () => {
    const onUpdateSuccess = vi.fn();
    await sposta(onUpdateSuccess, json({ success: false, code: 'future_date' }, 400));
    expect(await screen.findByText('La data dell\'allenamento non può essere nel futuro')).toBeTruthy();
    expect(onUpdateSuccess).not.toHaveBeenCalled();
  });
});

describe('giorno futuro nel fuso dell\'allenamento', () => {
  // Roma: 29 ottobre 03:00. A New York è ancora il 28 alle 22:00.
  const nyWorkout = { id: 7, date: '2026-10-28 21:00:00', time_zone: 'America/New_York', started_at: '2026-10-28T21:00:00-04:00' };
  const scegliOggi = async (w) => {
    setBrowserTimeZone('Europe/Rome');
    vi.setSystemTime(new Date('2026-10-29T02:00:00Z'));
    vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(JSON.parse(init?.body ?? '{}').preview ? json({ success: true }) : json({ success: false, code: 'future_date' }, 400))));
    render(<EditWorkoutDateDialog open onClose={() => {}} workout={w} onUpdateSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nuova data'), { target: { value: '2026-10-29' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  };

  it('allenamento in un altro fuso: dice che laggiù quel giorno non è ancora arrivato', async () => {
    await scegliOggi(nyWorkout);
    expect(await screen.findByText('A New York non è ancora il 29 ottobre: scegli un giorno precedente')).toBeTruthy();
  });

  it('allenamento nel fuso del dispositivo: resta il messaggio di prima', async () => {
    await scegliOggi({ ...nyWorkout, time_zone: 'Europe/Rome', started_at: '2026-10-28T21:00:00+01:00' });
    expect(await screen.findByText('La data dell\'allenamento non può essere nel futuro')).toBeTruthy();
  });

  it('allenamento senza fuso (backend vecchio): resta il messaggio di prima', async () => {
    await scegliOggi({ id: 7, date: '2026-10-28 21:00:00' });
    expect(await screen.findByText('La data dell\'allenamento non può essere nel futuro')).toBeTruthy();
  });
});

// Dialog «Modifica data»: l'avviso su Salute compare solo per gli allenamenti che il telefono ha scritto in Salute.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditWorkoutDateDialog from './EditWorkoutDateDialog';
import { json } from '../test/dom';

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

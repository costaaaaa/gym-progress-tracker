// Misure Corporee visto dall'utente: selettore del periodo, variazione del peso, stato vuoto e storico a pagine.
// La fetch è il confine; "oggi" è fissato al 20/10/2026.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BodyStats from './BodyStats';
import { formatDate } from '../i18n/format';

const row = (date, weight, extra = {}) => ({ id: date, date, weight, ...extra });

let records;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  records = [];
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ records }) })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mount = async () => {
  render(<BodyStats />);
  await screen.findByRole('group', { name: 'Periodo' });
};
const pill = (name) => screen.getByRole('button', { name });
const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('periodo e variazione del peso', () => {
  beforeEach(() => {
    records = [
      row('2025-12-01', '90.0'),
      row('2026-05-10', '85.0'),
      row('2026-08-10', '82.0'),
      row('2026-09-25', '81.0'),
      row('2026-10-15', '80.0'),
    ];
  });

  it('parte da 3 mesi: peso e variazione contano solo il periodo', async () => {
    await mount();
    expect(pill('3M').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('80.0 kg')).toBeTruthy();
    expect(screen.getByText(/-2,0 kg negli ultimi 3 mesi/)).toBeTruthy();
  });

  it('cambiando periodo cambiano variazione e testo', async () => {
    await mount();
    fireEvent.click(pill('1M'));
    expect(screen.getByText(/-1,0 kg nell'ultimo mese/)).toBeTruthy();
    fireEvent.click(pill('6M'));
    expect(screen.getByText(/-5,0 kg negli ultimi 6 mesi/)).toBeTruthy();
    fireEvent.click(pill('1A'));
    expect(screen.getByText(/-10,0 kg nell'ultimo anno/)).toBeTruthy();
    fireEvent.click(pill('Tutto'));
    expect(screen.getByText(/-10,0 kg dalla prima rilevazione/)).toBeTruthy();
  });

  it('un solo peso nel periodo: nessuna variazione, ma il valore c\'è', async () => {
    records = [row('2026-05-01', '85.0'), row('2026-10-15', '80.0')];
    await mount();
    expect(screen.getByText('80.0 kg')).toBeTruthy();
    expect(screen.queryByText(/kg negli ultimi 3 mesi/)).toBeNull();
  });

  it('una variazione di 0 si vede: "+0,0 kg"', async () => {
    records = [row('2026-08-10', '80.0'), row('2026-10-15', '80.0')];
    await mount();
    expect(screen.getByText(/\+0,0 kg negli ultimi 3 mesi/)).toBeTruthy();
  });
});

describe('periodo senza misure', () => {
  it('mostra l\'ultima rilevazione, senza peso se quella riga non ne ha, e Tutto riporta i grafici', async () => {
    records = [row('2026-01-10', '84.0'), row('2026-05-19', null, { chest_size: '100' })];
    await mount();
    expect(screen.getByText('Nessuna misura nel periodo')).toBeTruthy();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: —`)).toBeTruthy();

    fireEvent.click(pill('Tutto'));
    expect(screen.queryByText('Nessuna misura nel periodo')).toBeNull();
    expect(screen.getByText('84.0 kg')).toBeTruthy();
  });

  it('l\'ultima rilevazione porta il suo peso quando ce l\'ha', async () => {
    records = [row('2026-05-19', '83.5')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 83.5 kg`)).toBeTruthy();
  });

  it('con l\'API in ordine inverso la riga più recente resta la più recente', async () => {
    records = [row('2026-05-19', '83.5'), row('2026-01-10', '90.0')];
    await mount();
    expect(screen.getByText(`Ultima rilevazione il ${formatDate('2026-05-19')}: 83.5 kg`)).toBeTruthy();
  });
});

describe('storico a pagine', () => {
  beforeEach(() => {
    // 25 misure, una ogni 10 giorni all'indietro da oggi: la maggior parte fuori da 1M
    records = Array.from({ length: 25 }, (_, i) => {
      const d = new Date(2026, 9, 20 - 10 * (24 - i));
      return row(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, '80.0');
    });
  });

  it('10 righe alla volta, dalla più recente, con "1–10 di 25"', async () => {
    await mount();
    expect(tableRows()).toHaveLength(10);
    expect(within(tableRows()[0]).getByText(formatDate('2026-10-20'))).toBeTruthy();
    expect(screen.getByText('1–10 di 25')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagina precedente' }).disabled).toBe(true);
  });

  it('successive, ultima pagina e prima pagina', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Pagina successiva' }));
    expect(screen.getByText('11–20 di 25')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ultima pagina' }));
    expect(screen.getByText('21–25 di 25')).toBeTruthy();
    expect(tableRows()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Pagina successiva' }).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Prima pagina' }));
    expect(screen.getByText('1–10 di 25')).toBeTruthy();
  });

  it('lo storico non segue il periodo scelto', async () => {
    await mount();
    fireEvent.click(pill('1M'));
    expect(screen.getByText('1–10 di 25')).toBeTruthy();
  });
});

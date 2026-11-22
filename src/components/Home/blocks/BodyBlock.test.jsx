import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import BodyBlock from './BodyBlock';
import i18n from '../../../i18n';
import { renderBlock, stubFetch } from '../../../test/homeBlocks';
import { pinLocalClock } from '../../../test/timeZone';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const rec = (date, weight) => ({ id: date, date, weight, body_fat_percentage: null });
const RECORDS = [rec('2026-10-10', '80.00'), rec('2026-10-20', '79.00'), rec('2026-11-19', '78.40')];
const server = (records = RECORDS, extra = {}) => ({ 'user_stats/read.php': { records, consent_required: false, ...extra } });
const TODAY = '2026-11-19';

describe('blocco «Peso»', () => {
  it('piccola: ultimo peso e variazione dell\'ultimo mese, mini linea decorativa, link a Progressi > Corpo', async () => {
    stubFetch(server());
    renderBlock(<BodyBlock today={TODAY} weightUnit="kg" />);
    const link = (await screen.findByText('78,4 kg · -0,6 kg nell\'ultimo mese')).closest('a');
    expect(link.getAttribute('href')).toBe('/progressi?tab=body');
    expect(screen.getByRole('heading', { level: 2, name: 'Peso' })).toBeTruthy();
    const line = link.querySelector('svg polyline');
    expect(line.closest('svg').getAttribute('aria-hidden')).toBe('true');
    expect(line.getAttribute('points').split(' ').length).toBe(3);
  });

  it('peso salito: variazione col più; peso uguale: «Stabile nell\'ultimo mese»', async () => {
    stubFetch(server([rec('2026-10-25', '78.0'), rec('2026-11-19', '78.6')]));
    const view = renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78,6 kg · +0,6 kg nell\'ultimo mese')).toBeTruthy();
    view.unmount();
    stubFetch(server([rec('2026-10-25', '78.4'), rec('2026-11-19', '78.4')]));
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78,4 kg · Stabile nell\'ultimo mese')).toBeTruthy();
  });

  it('un solo peso: nessuna variazione e nessuna mini linea', async () => {
    stubFetch(server([rec('2026-11-19', '78.40')]));
    renderBlock(<BodyBlock today={TODAY} />);
    const link = (await screen.findByText('78,4 kg')).closest('a');
    expect(link.querySelector('svg polyline')).toBeNull();
  });

  it('più pesi ma uno solo nell\'ultimo mese: nessuna variazione, la mini linea c\'è', async () => {
    stubFetch(server([rec('2026-08-01', '81.0'), rec('2026-11-19', '78.40')]));
    renderBlock(<BodyBlock today={TODAY} />);
    const link = (await screen.findByText('78,4 kg')).closest('a');
    expect(link.querySelector('svg polyline')).not.toBeNull();
  });

  it('righe senza peso (solo circonferenze) non contano', async () => {
    stubFetch(server([rec('2026-10-25', null), rec('2026-11-19', '78.40'), rec('2026-11-20', null)]));
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78,4 kg')).toBeTruthy();
  });

  it('l\'ordine dell\'elenco non è un contratto: l\'ultimo è quello con la data più recente', async () => {
    stubFetch(server([...RECORDS].reverse()));
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78,4 kg · -0,6 kg nell\'ultimo mese')).toBeTruthy();
  });

  it('senza i pesi: «Aggiungi la prima misura», e anche in grande resta la riga', async () => {
    stubFetch(server([]));
    renderBlock(<BodyBlock today={TODAY} large />);
    const text = await screen.findByText('Aggiungi la prima misura');
    expect(text.closest('a').getAttribute('href')).toBe('/progressi?tab=body');
    expect(document.querySelector('svg polyline')).toBeNull();
  });

  it('senza consenso alla salute: «Aggiungi la prima misura», non un errore', async () => {
    stubFetch(server([], { consent_required: true }));
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('Aggiungi la prima misura')).toBeTruthy();
    expect(screen.queryByText('Dati non disponibili al momento.')).toBeNull();
  });

  it('grande: valore grande, variazione e linea più alta, senza ripetere la riga in testa', async () => {
    stubFetch(server());
    renderBlock(<BodyBlock today={TODAY} large />);
    await screen.findByText('78,4 kg');
    expect(screen.getAllByText('-0,6 kg nell\'ultimo mese').length).toBe(1);
    expect(screen.queryByText('78,4 kg · -0,6 kg nell\'ultimo mese')).toBeNull();
    expect(document.querySelectorAll('svg polyline').length).toBe(1);
  });

  it('unità lb: peso e variazione nell\'unità dell\'account', async () => {
    stubFetch(server());
    renderBlock(<BodyBlock today={TODAY} weightUnit="lb" />);
    expect(await screen.findByText('172,8 lb · -1,3 lb nell\'ultimo mese')).toBeTruthy();
  });

  it('in inglese: testi e decimali della lingua', async () => {
    await i18n.changeLanguage('en');
    stubFetch(server());
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78.4 kg · -0.6 kg in the last month')).toBeTruthy();
  });

  it('caricamento: segnaposto, nessun peso', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderBlock(<BodyBlock today={TODAY} />);
    expect(screen.getByTestId('block-skeleton')).toBeTruthy();
    expect(screen.queryByText(/kg/)).toBeNull();
  });

  it.each([[{ status: 500 }], [{ nonsense: true }]])('risposta non buona (%j): dati non disponibili, il link resta', async (body) => {
    stubFetch({ 'user_stats/read.php': body });
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('Dati non disponibili al momento.')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/progressi?tab=body');
  });

  it('senza `today` (dashboard in errore): «oggi» è l\'ultima data delle misure', async () => {
    stubFetch(server());
    renderBlock(<BodyBlock weightUnit="kg" />);
    expect(await screen.findByText('78,4 kg · -0,6 kg nell\'ultimo mese')).toBeTruthy();
  });

  it('il confine del mese è incluso: oggi 19/11, un peso del 19/10 conta', async () => {
    stubFetch(server([rec('2026-10-18', '90'), rec('2026-10-19', '79.4'), rec('2026-11-19', '78.4')]));
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78,4 kg · -1 kg nell\'ultimo mese')).toBeTruthy();
  });

  it('il tocco porta al Corpo', async () => {
    stubFetch(server());
    renderBlock(<BodyBlock today={TODAY} />);
    fireEvent.click((await screen.findByText(/78,4 kg/)).closest('a'));
    expect(screen.getByTestId('where').textContent).toBe('/progressi?tab=body');
  });
});

// «Oggi» è la data del server: l'orologio del dispositivo, finto e diverso, non sposta il mese
describe('blocco «Peso»: il periodo parte da today del server', () => {
  it.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('con il dispositivo a un\'altra data (%s) la variazione resta quella di today', async (zone) => {
    pinLocalClock(zone, 2026, 11, 1, 0, 30);
    stubFetch(server());
    renderBlock(<BodyBlock today={TODAY} />);
    expect(await screen.findByText('78,4 kg · -0,6 kg nell\'ultimo mese')).toBeTruthy();
  });

  it.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('mezzanotte vicina al confine (%s): today 01/12 parte dal 01/11, non da un giorno prima', async (zone) => {
    // Dispositivo al 30/11 23:50 (mese 10 = novembre): con l'orologio del dispositivo il periodo partirebbe dal 30/10,
    // includerebbe la misura del 31/10 e darebbe «-2 kg»; da today del server (01/12) parte dal 01/11 e dà «-1 kg»
    pinLocalClock(zone, 2026, 10, 30, 23, 50);
    stubFetch(server([rec('2026-10-31', '80'), rec('2026-11-01', '79'), rec('2026-12-01', '78')]));
    renderBlock(<BodyBlock today="2026-12-01" />);
    expect(await screen.findByText('78 kg · -1 kg nell\'ultimo mese')).toBeTruthy();
  });
});

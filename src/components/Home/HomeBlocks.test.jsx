import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import HomeBlocks from './HomeBlocks';
import { renderBlock, stubFetch } from '../../test/homeBlocks';
import { HOME_BLOCKS, effectiveLayout } from '../../utils/homeLayout';
import { unnamedControls } from '../../test/accessibleNames';
import { textBelow } from '../../test/minText';

// Gli altri blocchi nascosti: così non chiamano il server
const only = (key) => ({ username: 'mario88', home_layout: HOME_BLOCKS.map((k) => ({ key: k, hidden: k !== key, large: false })) });
const blocks = (dashboardStatus) => (
  <HomeBlocks user={only('recovery')} weightUnit="kg" lastWorkout={null} stats={dashboardStatus === 'ok' ? { recovery: {} } : null} dashboardStatus={dashboardStatus} />
);

describe('HomeBlocks: stato della dashboard nel vocabolario dei blocchi', () => {
  it('pending: segnaposto, non il testo d\'errore', () => {
    renderBlock(blocks('pending'));
    expect(screen.getByTestId('block-skeleton')).toBeTruthy();
    expect(screen.queryByText('Dati non disponibili al momento.')).toBeNull();
  });

  it('failed: testo d\'errore', () => {
    renderBlock(blocks('failed'));
    expect(screen.getByText('Dati non disponibili al momento.')).toBeTruthy();
    expect(screen.queryByTestId('block-skeleton')).toBeNull();
  });

  it('ok: il dato del blocco', () => {
    renderBlock(blocks('ok'));
    expect(screen.getByText('Nessun dato ancora')).toBeTruthy();
  });

  it('il layout viene dall\'account (user.home_layout)', () => {
    renderBlock(<HomeBlocks user={{ username: 'x', home_layout: HOME_BLOCKS.map((key) => ({ key, hidden: true, large: false })) }} weightUnit="kg" lastWorkout={null} stats={{ recovery: {} }} dashboardStatus="ok" />);
    expect(screen.queryAllByRole('heading', { level: 2 })).toEqual([]);
  });
});

describe('HomeBlocks: modifica', () => {
  const RESPONSES = {
    'gamification/profile.php': { success: true, level: 5, xp_into_level: 120, xp_for_next_level: 300 },
    'gamification/streak.php': { success: true, current_streak_weeks: 4 },
    'groups/list.php': { success: true, groups: [] },
    'user_stats/read.php': { consent_required: false, records: [{ id: 1, date: '2026-11-18', weight: '78.40' }] },
  };
  const WORKOUT = { id: 1, date: '2026-11-18 18:30:00', day_name: 'Giorno A', exercises: [] };
  afterEach(() => { document.body.innerHTML = ''; });

  // Un genitore che tiene il layout come fa la Home: `onChange(mossa)` applica la mossa all'ultimo layout e lo restituisce
  const Harness = ({ modules, saved = null, lastWorkout = WORKOUT }) => {
    const [layout, setLayout] = useState(effectiveLayout(saved));
    let current = layout;
    const onChange = (move) => { current = move(current); setLayout(current); return current; };
    return (
      <HomeBlocks user={{ username: 'x', modules }} weightUnit="kg" lastWorkout={lastWorkout} stats={{ recovery: {} }} dashboardStatus="ok" editing layout={layout} onChange={onChange} />
    );
  };
  const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  const button = (name) => screen.getByRole('button', { name });
  const live = () => document.querySelector('[aria-live="polite"]');

  it('ogni blocco ha i suoi comandi con nomi che dicono quale blocco; «Ultimo allenamento» non ha la misura', () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness />);
    expect(titles()).toEqual(['Ultimo allenamento', 'Livello e streak', 'Gruppi', 'Recupero', 'Peso']);
    ['Sposta su Peso', 'Sposta giù Peso', 'Nascondi Peso', 'Rendi Peso grande', 'Nascondi Ultimo allenamento', 'Sposta giù Ultimo allenamento'].forEach((name) => expect(button(name)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Rendi Ultimo allenamento/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Rendi .* grande$/ }).length).toBe(4);
  });

  it('in modifica i blocchi non sono link e i comandi sono ≥ 44 px, con testo ≥ 13 px e nomi accessibili', () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness />);
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(getComputedStyle(button('Sposta su Peso')).height).toBe('44px');
    expect(getComputedStyle(button('Sposta su Peso')).width).toBe('44px');
    expect(getComputedStyle(button('Nascondi Peso')).minHeight).toBe('44px');
    expect(unnamedControls()).toEqual([]);
    // L'etichetta «Ultimo allenamento» è la stessa di sempre (12 px, maiuscola); tutto il resto è almeno 13 px
    expect(textBelow(document.body, 13)).toEqual(['Ultimo allenamento (12px)']);
  });

  it('ai capi «su» e «giù» sono disabilitati ma restano raggiungibili, e un clic non cambia nulla', () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness />);
    expect(button('Sposta su Ultimo allenamento').getAttribute('aria-disabled')).toBe('true');
    expect(button('Sposta giù Peso').getAttribute('aria-disabled')).toBe('true');
    expect(button('Sposta giù Ultimo allenamento').getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(button('Sposta su Ultimo allenamento'));
    expect(titles()[0]).toBe('Ultimo allenamento');
    expect(live().textContent).toBe('');
  });

  it('sposta: cambia l\'ordine, il fuoco resta sul bottone premuto e l\'esito è annunciato', async () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness />);
    button('Sposta su Peso').focus();
    fireEvent.click(button('Sposta su Peso'));
    expect(titles()).toEqual(['Ultimo allenamento', 'Livello e streak', 'Gruppi', 'Peso', 'Recupero']);
    await waitFor(() => expect(document.activeElement).toBe(button('Sposta su Peso')));
    expect(live().textContent).toBe('Peso spostato in posizione 4 di 5');
    // Fino in cima: il bottone diventa disabilitato e il fuoco non si perde
    fireEvent.click(button('Sposta su Peso'));
    fireEvent.click(button('Sposta su Peso'));
    fireEvent.click(button('Sposta su Peso'));
    expect(titles()[0]).toBe('Peso');
    expect(button('Sposta su Peso').getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button('Sposta su Peso'));
    expect(live().textContent).toBe('Peso spostato in posizione 1 di 5');
  });

  it('un modulo non attivo non compare e non conta come vicino: «Livello» salta «Gruppi» e il conteggio è dei blocchi elencati', () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness modules={{ groups: false }} />);
    expect(titles()).toEqual(['Ultimo allenamento', 'Livello e streak', 'Recupero', 'Peso']);
    fireEvent.click(button('Sposta giù Livello e streak'));
    expect(titles()).toEqual(['Ultimo allenamento', 'Recupero', 'Livello e streak', 'Peso']);
    expect(live().textContent).toBe('Livello e streak spostato in posizione 3 di 4');
  });

  it('nascondi: il blocco resta in modifica, attenuato, con «Nascosto» scritto e senza caricare i dati; «Mostra» lo riporta', async () => {
    const fake = stubFetch(RESPONSES);
    renderBlock(<Harness saved={[{ key: 'body', hidden: true, large: false }]} />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Peso' });
    expect(within(heading.closest('[data-testid="home-block-hidden"]')).getByText('Nascosto')).toBeTruthy();
    expect(fake.mock.calls.some(([url]) => String(url).includes('user_stats/read.php'))).toBe(false);
    expect(titles()[0]).toBe('Peso');
    button('Mostra Peso').focus();
    fireEvent.click(button('Mostra Peso'));
    expect(screen.queryByText('Nascosto')).toBeNull();
    await waitFor(() => expect(fake.mock.calls.some(([url]) => String(url).includes('user_stats/read.php'))).toBe(true));
    expect(live().textContent).toBe('Peso di nuovo visibile');
    await waitFor(() => expect(document.activeElement).toBe(button('Nascondi Peso')));
  });

  it('nascondere un blocco tiene il fuoco sul bottone e lo annuncia', async () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness />);
    button('Nascondi Recupero').focus();
    fireEvent.click(button('Nascondi Recupero'));
    expect(live().textContent).toBe('Recupero nascosto');
    await waitFor(() => expect(document.activeElement).toBe(button('Mostra Recupero')));
    expect(screen.getByText('Nascosto')).toBeTruthy();
  });

  it('grande e piccola: la misura cambia, il bottone cambia nome, l\'esito è annunciato', async () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness />);
    button('Rendi Peso grande').focus();
    fireEvent.click(button('Rendi Peso grande'));
    expect(live().textContent).toBe('Peso ora grande');
    expect(await screen.findByRole('button', { name: 'Rendi Peso piccola' })).toBeTruthy();
    expect(document.activeElement).toBe(button('Rendi Peso piccola'));
    fireEvent.click(button('Rendi Peso piccola'));
    expect(live().textContent).toBe('Peso ora piccola');
  });

  it('«Ultimo allenamento» compare in modifica anche senza allenamento da mostrare: il titolo con i comandi', () => {
    stubFetch(RESPONSES);
    renderBlock(<Harness lastWorkout={null} />);
    expect(titles()[0]).toBe('Ultimo allenamento');
    expect(button('Nascondi Ultimo allenamento')).toBeTruthy();
  });

  it('i comandi non stanno dentro un link e fuori dalla modifica non ci sono', () => {
    stubFetch(RESPONSES);
    renderBlock(<HomeBlocks user={{ username: 'x' }} weightUnit="kg" lastWorkout={WORKOUT} stats={{ recovery: {} }} dashboardStatus="ok" />);
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(document.querySelector('[aria-live]')).toBeNull();
    expect(screen.getAllByRole('link').length).toBe(5);
  });
});

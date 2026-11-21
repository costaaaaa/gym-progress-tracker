import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import BlockShell from './BlockShell';
import { renderBlock, reducedMotion } from '../../../test/homeBlocks';
import { textBelow } from '../../../test/minText';

const realMatchMedia = window.matchMedia;
afterEach(() => { window.matchMedia = realMatchMedia; });

const shell = (props) => (
  <BlockShell title="Peso" to="/dashboard?tab=body" status="ok" summary="78,4 kg" {...props}>
    <p>Contenuto pieno</p>
  </BlockShell>
);

describe('guscio dei blocchi', () => {
  it('piccola: titolo h2, una riga con il dato, tutta la riga è un link alla pagina del modulo, il contenuto pieno non c\'è', () => {
    renderBlock(shell());
    const link = screen.getByRole('heading', { level: 2, name: 'Peso' }).closest('a');
    expect(link.getAttribute('href')).toBe('/dashboard?tab=body');
    expect(link.textContent).toContain('78,4 kg');
    expect(screen.queryByText('Contenuto pieno')).toBeNull();
  });

  it('la freccia è decorativa e il segno sta a destra, dentro il link', () => {
    renderBlock(shell({ sign: <span data-testid="segno" /> }));
    const link = screen.getByRole('link');
    expect(link.querySelector('svg[data-testid="ChevronRightIcon"]').getAttribute('aria-hidden')).toBe('true');
    expect(within(link).getByTestId('segno')).toBeTruthy();
  });

  it('la zona di tocco è di almeno 44 px e nessun testo scende sotto i 13 px', () => {
    renderBlock(shell());
    expect(getComputedStyle(screen.getByRole('link')).minHeight).toBe('44px');
    expect(textBelow(document.body, 13)).toEqual([]);
  });

  it('grande: la riga in testa resta il link e sotto c\'è il contenuto pieno', () => {
    renderBlock(shell({ large: true }));
    expect(screen.getByText('Contenuto pieno')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard?tab=body');
    expect(screen.getByRole('link').textContent).not.toContain('Contenuto pieno');
  });

  it('senza dato la riga in testa ha solo il titolo (il contenuto pieno lo dice già)', () => {
    renderBlock(shell({ large: true, summary: null }));
    expect(screen.getByRole('link').querySelectorAll('p').length).toBe(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Peso' })).toBeTruthy();
  });

  it('caricamento: titolo e segnaposto, nessun dato, aria-busy', () => {
    renderBlock(shell({ status: 'loading', summary: 'NON DEVE COMPARIRE', large: true }));
    expect(screen.getByRole('heading', { level: 2, name: 'Peso' })).toBeTruthy();
    expect(screen.getByTestId('block-skeleton')).toBeTruthy();
    expect(screen.queryByText('NON DEVE COMPARIRE')).toBeNull();
    expect(screen.queryByText('Contenuto pieno')).toBeNull();
    expect(screen.getByTestId('home-block').getAttribute('aria-busy')).toBe('true');
  });

  it('errore: titolo e link restano, la riga dice che i dati non sono disponibili, anche in grande', () => {
    renderBlock(shell({ status: 'error', summary: 'NO', large: true }));
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard?tab=body');
    expect(screen.getByText('Dati non disponibili al momento.')).toBeTruthy();
    expect(screen.queryByText('NO')).toBeNull();
    expect(screen.queryByText('Contenuto pieno')).toBeNull();
  });

  it('il tocco porta alla pagina del modulo', () => {
    renderBlock(shell());
    fireEvent.click(screen.getByRole('link'));
    expect(screen.getByTestId('where').textContent).toBe('/dashboard?tab=body');
  });

});

// La misura cambia con una prop: il guscio anima già, anche se in questa PR la misura viene solo dal layout salvato
describe('guscio dei blocchi: cambio di misura', () => {
  const Toggle = () => {
    const [large, setLarge] = useState(false);
    return (
      <>
        <button onClick={() => setLarge((value) => !value)}>cambia</button>
        {shell({ large })}
      </>
    );
  };
  const duration = () => document.querySelector('.MuiCollapse-root').style.transitionDuration;

  it('si apre e si chiude con un Collapse di 250 ms: il contenuto resta finché la chiusura non è finita', async () => {
    renderBlock(<Toggle />);
    expect(screen.queryByText('Contenuto pieno')).toBeNull();
    fireEvent.click(screen.getByText('cambia'));
    expect(screen.getByText('Contenuto pieno')).toBeTruthy();
    expect(duration()).toBe('250ms');
    fireEvent.click(screen.getByText('cambia'));
    expect(screen.getByText('Contenuto pieno')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Contenuto pieno')).toBeNull());
  });

  it('con «riduci movimento» la durata è 0', () => {
    reducedMotion(true);
    renderBlock(<Toggle />);
    fireEvent.click(screen.getByText('cambia'));
    expect(screen.getByText('Contenuto pieno')).toBeTruthy();
    expect(duration()).toBe('0ms');
  });
});

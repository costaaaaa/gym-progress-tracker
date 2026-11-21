import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import RecoveryBlock from './RecoveryBlock';
import i18n from '../../../i18n';
import { renderBlock } from '../../../test/homeBlocks';

const ready = (day = '2026-11-10') => ({ percent: 100, status: 'PRONTO', last_trained: day, ready_at: null });
const resting = { percent: 40, status: 'IN RECUPERO', last_trained: '2026-11-19', ready_at: '2099-01-01T10:00:00+01:00' };
const DATA = { petto: ready(), schiena: ready(), spalle: ready(), bicipiti: resting, tricipiti: resting, addome: { percent: 100, status: 'PRONTO', last_trained: null, ready_at: null } };

describe('blocco «Recupero»', () => {
  it('piccola: muscoli pronti e in recupero, link ai muscoli; chi non è mai stato allenato non conta', () => {
    renderBlock(<RecoveryBlock status="ok" recovery={DATA} detail="full" />);
    const link = screen.getByText('3 muscoli pronti · 2 in recupero').closest('a');
    expect(link.getAttribute('href')).toBe('/dashboard?tab=muscles');
    expect(screen.getByRole('heading', { level: 2, name: 'Recupero' })).toBeTruthy();
    expect(screen.queryByText('Puoi allenare')).toBeNull();
  });

  it('un muscolo pronto: singolare; solo pronti o solo in recupero: una parte sola', () => {
    const view = renderBlock(<RecoveryBlock status="ok" recovery={{ petto: ready() }} />);
    expect(screen.getByText('1 muscolo pronto')).toBeTruthy();
    view.unmount();
    renderBlock(<RecoveryBlock status="ok" recovery={{ bicipiti: resting }} />);
    expect(screen.getByText('1 in recupero')).toBeTruthy();
  });

  it.each([[undefined], [null], [{}], [{ petto: { status: 'PRONTO', last_trained: null } }]])('senza dati (%j): «Nessun dato ancora»', (recovery) => {
    renderBlock(<RecoveryBlock status="ok" recovery={recovery} />);
    expect(screen.getByText('Nessun dato ancora')).toBeTruthy();
  });

  it('con il piano Gratis (detail basic) la riga è la stessa', () => {
    renderBlock(<RecoveryBlock status="ok" recovery={{ petto: { status: 'PRONTO', last_trained: '2026-11-10' }, schiena: { status: 'IN RECUPERO', last_trained: '2026-11-19' } }} detail="basic" />);
    expect(screen.getByText('1 muscolo pronto · 1 in recupero')).toBeTruthy();
  });

  it('grande: lo stato muscolare com\'è (BodyVisualizer), con il suo detail', () => {
    renderBlock(<RecoveryBlock status="ok" recovery={DATA} detail="full" large />);
    expect(screen.getByText('Puoi allenare')).toBeTruthy();
    expect(screen.getByText('A riposo')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Petto' })).toBeTruthy();
  });

  it('grande con detail basic: le righe senza percentuali', () => {
    renderBlock(<RecoveryBlock status="ok" recovery={{ petto: { status: 'PRONTO', last_trained: '2026-11-10' } }} detail="basic" large />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Puoi allenare')).toBeTruthy();
  });

  it('dashboard in errore: titolo e link restano, dati non disponibili', () => {
    renderBlock(<RecoveryBlock status="error" recovery={undefined} large />);
    expect(screen.getByText('Dati non disponibili al momento.')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard?tab=muscles');
    expect(screen.queryByText('Puoi allenare')).toBeNull();
  });

  it('dati in arrivo: segnaposto, nessun numero', () => {
    renderBlock(<RecoveryBlock status="loading" recovery={DATA} />);
    expect(screen.getByTestId('block-skeleton')).toBeTruthy();
    expect(screen.queryByText(/muscoli pronti/)).toBeNull();
  });

  it('in inglese', async () => {
    await i18n.changeLanguage('en');
    renderBlock(<RecoveryBlock status="ok" recovery={DATA} />);
    expect(screen.getByText('3 muscles ready · 2 recovering')).toBeTruthy();
  });

  it('il tocco porta ai muscoli', () => {
    renderBlock(<RecoveryBlock status="ok" recovery={DATA} />);
    fireEvent.click(screen.getByRole('link'));
    expect(screen.getByTestId('where').textContent).toBe('/dashboard?tab=muscles');
  });
});

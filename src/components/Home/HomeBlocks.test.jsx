import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import HomeBlocks from './HomeBlocks';
import { renderBlock } from '../../test/homeBlocks';
import { HOME_BLOCKS } from '../../utils/homeLayout';

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

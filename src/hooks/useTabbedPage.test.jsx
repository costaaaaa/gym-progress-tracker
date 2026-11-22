// Tab nell'indirizzo: un nome vecchio (alias) porta alla tab che ha preso il suo posto, senza passare dalla prima.
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useTabbedPage } from './useTabbedPage';

const TABS = [{ id: 'one', label: 'dashboard.tab.progress' }, { id: 'two', label: 'dashboard.tab.volume' }];
const ALIASES = { old: 'two' };

const Probe = ({ aliases }) => {
  const { currentTab } = useTabbedPage(TABS, { title: 'Pagina', description: '', aliases });
  return <p data-testid="tab">{`${currentTab} ${useLocation().search}`}</p>;
};
const open = (path, aliases) => render(<MemoryRouter initialEntries={[path]}><Probe aliases={aliases} /></MemoryRouter>);

describe('alias delle tab', () => {
  it('un alias apre la tab nuova e la mette nell\'indirizzo (replace), non la prima', async () => {
    open('/p?tab=old', ALIASES);
    expect(screen.getByTestId('tab').textContent.startsWith('two ')).toBe(true);
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('two ?tab=two'));
  });

  it('senza alias una tab sconosciuta torna alla prima', async () => {
    open('/p?tab=old');
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('one ?tab=one'));
  });

  it('una tab valida resta com\'è', () => {
    open('/p?tab=two', ALIASES);
    expect(screen.getByTestId('tab').textContent).toBe('two ?tab=two');
  });
});

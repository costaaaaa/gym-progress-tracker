// Consenso all'ingresso in un gruppo: lo username si vede sempre, il resto sono le quattro opzioni dell'account (si
// salvano subito, valgono per tutti i gruppi). La fetch è il confine; lo stato dell'account è un finto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import ShareConsentDialog from './ShareConsentDialog';
import { json } from '../../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

const ALL = { workouts: true, volume: true, streak: true, level: true };
let settings;
const onConfirm = vi.fn();

beforeEach(() => {
  onConfirm.mockClear();
  settings = (body) => json({ success: true, group_visibility: { ...ALL, ...body.group_visibility } });
  vi.stubGlobal('fetch', vi.fn((url, init) => Promise.resolve(settings(JSON.parse(init.body)))));
});
afterEach(() => vi.unstubAllGlobals());

const Harness = ({ initial }) => {
  const [user, setUser] = useState(initial);
  auth.value = { user, updateUser: (patch) => setUser((u) => ({ ...u, ...patch })) };
  return <ShareConsentDialog open groupName="G" username="u" loading={false} onClose={() => {}} onConfirm={onConfirm} />;
};
const mount = (user = { id: 1, modules: { levels: true } }) => render(<Harness initial={user} />);
const sw = (name) => screen.getByRole('switch', { name });

describe('consenso all\'ingresso in un gruppo', () => {
  it('lo username si vede sempre; le quattro opzioni partono nello stato dell\'account (nuovo: tutte mostrate)', () => {
    mount();
    expect(screen.getByText('il tuo username (u)')).toBeTruthy();
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label')))
      .toEqual(['Allenamenti della settimana', 'Volume', 'Streak', 'Livello']);
    screen.getAllByRole('switch').forEach((s) => expect(s.checked).toBe(true));
    expect(screen.getByText('Se non mostri un dato, non vedi quello degli altri membri.')).toBeTruthy();
  });

  it('rispecchia le scelte già fatte e le dipendenze (livelli non attivo: streak e livello non modificabili)', () => {
    mount({ id: 1, modules: { levels: false }, group_visibility: { ...ALL, volume: false } });
    expect(sw('Volume').checked).toBe(false);
    expect(sw('Streak').disabled).toBe(true);
    expect(sw('Livello').disabled).toBe(true);
  });

  it('dice che vale per tutti i gruppi e la frase del consenso è quella nuova', () => {
    mount();
    expect(screen.getByText('Vale per tutti i tuoi gruppi; puoi cambiarlo dall\'account.')).toBeTruthy();
    expect(screen.getByLabelText('Accetto che i membri del gruppo vedano il mio username e i dati che scelgo di mostrare')).toBeTruthy();
  });

  it('un cambio si salva subito sull\'account e lo annuncia', async () => {
    mount();
    fireEvent.click(sw('Volume'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Volume: non mostro'));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ group_visibility: { volume: false } });
    expect(sw('Volume').checked).toBe(false);
  });

  it('errore di salvataggio: visibile nella finestra, l\'interruttore torna com\'era e l\'ingresso resta possibile', async () => {
    settings = () => json({ success: false }, 500);
    mount();
    fireEvent.click(sw('Livello'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Errore nel salvataggio/));
    expect(sw('Livello').checked).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Entra nel gruppo' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

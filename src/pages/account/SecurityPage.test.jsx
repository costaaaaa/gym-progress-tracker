// Pagina «Sicurezza» (/account/sicurezza): il cambio password, con la riga della conferma e gli occhi dei campi.
// Colori scritti a mano: text.primary #1a1816, text.secondary #6b6663. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { json } from '../../test/dom';
import { describedBy } from '../../test/accessibleNames';
import { renderAccount } from '../../test/accountRoutes';

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => () => {} }));
vi.mock('../../context/AuthContext', () => {
  const auth = {
    user: { id: 1 }, isLoggedIn: true, loading: false, logout: () => {}, updateUser: () => {},
    emailState: { verified: true, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: null },
    openEmailDialog: () => {}, refreshEmailState: () => Promise.resolve(),
  };
  return { useAuth: () => auth };
});

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('user/read.php') ? json({ id: 1, username: 'mario', email: 'mario@example.com', created_at: '2025-03-01T10:00:00+01:00', weekly_goal_default: 3 })
      : json({ success: true, consents: [], id: 1, weekly_goal_default: 3 }),
  )));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const mount = async () => {
  renderAccount('/account/sicurezza');
  await screen.findByRole('button', { name: 'Cambia password' });
};
const button = (name) => screen.getByRole('button', { name });

describe('bottoni', () => {
  it('«Cambia password» è outlined neutro: testo in inchiostro e bordo grigio visibile', async () => {
    await mount();
    const style = getComputedStyle(screen.getAllByRole('button', { name: 'Cambia password' }).find((b) => b.classList.contains('MuiButton-outlined')));
    expect(style.color).toBe(INK);
    expect(style.borderColor).toBe(GREY);
  });
});

describe('password', () => {
  const apriCambioPassword = async () => {
    await mount();
    fireEvent.click(button('Cambia password'));
    return screen.findByRole('dialog');
  };

  it('i campi del cambio password dichiarano a cosa servono (autocomplete)', async () => {
    const dialog = await apriCambioPassword();
    expect(within(dialog).getByLabelText(/^Password attuale/).getAttribute('autocomplete')).toBe('current-password');
    expect(within(dialog).getByLabelText(/^Nuova password/).getAttribute('autocomplete')).toBe('new-password');
    expect(within(dialog).getByLabelText(/^Conferma nuova password/).getAttribute('autocomplete')).toBe('new-password');
  });

  it('i tre occhi hanno un nome in italiano che distingue i campi', async () => {
    const dialog = await apriCambioPassword();
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la password attuale' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la nuova password' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Mostra o nascondi la conferma della password' })).toBeTruthy();
  });

  describe('conferma della nuova password: riga riservata', () => {
    const NEW = 'Nuova!Pass2026';
    const confirmField = (dialog) => within(dialog).getByLabelText(/^Conferma nuova password/);
    const fill = (dialog, { current = 'Vecchia!Pass1', next = NEW, confirm } = {}) => {
      fireEvent.change(within(dialog).getByLabelText(/^Password attuale/), { target: { value: current } });
      fireEvent.change(within(dialog).getByLabelText(/^Nuova password/), { target: { value: next } });
      if (confirm !== undefined) fireEvent.change(confirmField(dialog), { target: { value: confirm } });
    };
    const save = (dialog) => fireEvent.click(within(dialog).getByRole('button', { name: 'Salva' }));

    it('a campo vuoto suggerimento grigio; uguali spunta e annuncio; diverse e uscita: rosso e annuncio', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog);
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(within(dialog).getByRole('status').textContent).toBe('');
      fireEvent.change(confirmField(dialog), { target: { value: NEW } });
      expect(describedBy(confirmField(dialog))).toBe('Le password coincidono');
      expect(within(dialog).getByRole('status').textContent).toBe('Le password coincidono');
      fireEvent.change(confirmField(dialog), { target: { value: 'Nuova!Pass' } });
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      fireEvent.blur(confirmField(dialog));
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      expect(within(dialog).getByRole('status').textContent).toBe('Le password non coincidono');
    });

    it('l\'occhio della conferma non è un\'uscita dal campo', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      const eye = within(dialog).getByRole('button', { name: 'Mostra o nascondi la conferma della password' });
      fireEvent.blur(confirmField(dialog), { relatedTarget: eye });
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(fireEvent.mouseDown(eye)).toBe(false);
    });

    it('«Salva» con conferma diversa: riga rossa, focus sul campo, niente avviso in alto, nessuna chiamata', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      const calls = fetch.mock.calls.length;
      save(dialog);
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(confirmField(dialog));
      expect(within(dialog).queryByRole('alert')).toBeNull();
      expect(fetch.mock.calls.length).toBe(calls);
    });

    it('«Salva» con la conferma vuota: «Tutti i campi sono obbligatori» in alto, la riga resta il suggerimento', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog);
      save(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe('Tutti i campi sono obbligatori');
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
    });

    it('un avviso in alto di un invio precedente sparisce quando poi la conferma è diversa', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog);
      save(dialog);
      expect(within(dialog).getByRole('alert')).toBeTruthy();
      fireEvent.change(confirmField(dialog), { target: { value: 'Nuova!Pass' } });
      save(dialog);
      expect(within(dialog).queryByRole('alert')).toBeNull();
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
    });

    it('le altre regole restano nell\'avviso in alto: password fuori regola, uguale all\'attuale', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { next: 'corta', confirm: 'corta' });
      save(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe('La password deve contenere almeno 8 caratteri');
      fill(dialog, { current: NEW, next: NEW, confirm: NEW });
      save(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe('La nuova password deve essere diversa da quella attuale');
    });

    it('uscire da «Nuova password» con la conferma scritta e diversa mostra il rosso', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      fireEvent.blur(within(dialog).getByLabelText(/^Nuova password/));
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      expect(describedBy(confirmField(dialog))).toBe('Le password non coincidono');
    });

    it('uscire da «Password attuale» non mostra il rosso: non fa parte della coppia', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      fireEvent.blur(within(dialog).getByLabelText(/^Password attuale/));
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
    });

    it('dopo il rosso, modificare «Nuova password» (restando diversa) riporta il suggerimento', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      fireEvent.blur(confirmField(dialog));
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(within(dialog).getByLabelText(/^Nuova password/), { target: { value: 'Nuova!Pass2027' } });
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('false');
      expect(describedBy(confirmField(dialog))).toBe('Riscrivi la stessa password');
    });

    it('il clic sull\'occhio di «Nuova password» non toglie il focus al campo', async () => {
      const dialog = await apriCambioPassword();
      const eye = within(dialog).getByRole('button', { name: 'Mostra o nascondi la nuova password' });
      expect(fireEvent.mouseDown(eye)).toBe(false);
    });

    it('alla riapertura niente rosso rimasto dalla volta prima', async () => {
      const dialog = await apriCambioPassword();
      fill(dialog, { confirm: 'Nuova!Pass' });
      save(dialog);
      expect(confirmField(dialog).getAttribute('aria-invalid')).toBe('true');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      fireEvent.click(button('Cambia password'));
      const again = await screen.findByRole('dialog');
      fill(again, { confirm: 'Nuova!Pass' });
      expect(confirmField(again).getAttribute('aria-invalid')).toBe('false');
      expect(describedBy(confirmField(again))).toBe('Riscrivi la stessa password');
    });
  });

  it.each([
    ['password attuale', /^Password attuale/, 'Mostra o nascondi la password attuale'],
    ['nuova password', /^Nuova password/, 'Mostra o nascondi la nuova password'],
    ['conferma', /^Conferma nuova password/, 'Mostra o nascondi la conferma della password'],
  ])('occhio di «%s»: il mouseDown è annullato e il clic alterna password e testo', async (_n, label, name) => {
    const dialog = await apriCambioPassword();
    const eye = within(dialog).getByRole('button', { name });
    expect(fireEvent.mouseDown(eye)).toBe(false);
    expect(within(dialog).getByLabelText(label).getAttribute('type')).toBe('password');
    fireEvent.click(eye);
    expect(within(dialog).getByLabelText(label).getAttribute('type')).toBe('text');
    fireEvent.click(eye);
    expect(within(dialog).getByLabelText(label).getAttribute('type')).toBe('password');
  });
});

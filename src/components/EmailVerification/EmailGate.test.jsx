// Finestra del codice, promemoria del giorno, striscia e avviso di esito. Lo stato di AuthContext è finto: qui
// conta cosa fanno i componenti con quello che il contesto dice.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailGate from './EmailGate';
import EmailStrip from './EmailStrip';
import { DRAFT_STORAGE_KEY } from '../../utils/focusDraft';

const auth = {};
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const state = (extra = {}) => ({
  verified: false, email: 'mario@example.com', pendingEmail: null, blocked: false, daysLeft: 5, deadline: '2026-11-24T10:00:00Z', ...extra,
});

let claimed;
beforeEach(() => {
  claimed = false;
  Object.assign(auth, {
    isLoggedIn: true,
    user: { id: 7 },
    emailState: state(),
    emailDialogOpen: false,
    openEmailDialog: vi.fn(() => { auth.emailDialogOpen = true; }),
    closeEmailDialog: vi.fn(() => { auth.emailDialogOpen = false; }),
    refreshEmailState: vi.fn(() => Promise.resolve()),
    claimEmailReminder: vi.fn(() => { const first = !claimed; claimed = true; return first; }),
  });
});
afterEach(() => vi.useRealTimers());

const mountGate = () => render(<EmailGate />);
const dialog = () => screen.queryByRole('dialog', { name: 'Conferma la tua email' });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('striscia', () => {
  const strip = () => render(<EmailStrip />);

  it.each([
    [5, 'Conferma la tua email: ti restano 5 giorni.'],
    [2, 'Conferma la tua email: ti restano 2 giorni.'],
    [1, 'Conferma la tua email: scade oggi.'],
    [0, 'Conferma la tua email: scade oggi.'],
  ])('con %i giorni rimasti dice «%s»', (daysLeft, text) => {
    auth.emailState = state({ daysLeft });
    strip();
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('il comando apre la finestra del codice', () => {
    strip();
    fireEvent.click(screen.getByRole('button', { name: 'Scrivi il codice' }));
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['email confermata', { verified: true, daysLeft: null }],
    ['app bloccata', { blocked: true, daysLeft: 0 }],
  ])('non c\'è con %s', (_name, extra) => {
    auth.emailState = state(extra);
    strip();
    expect(screen.queryByRole('region', { name: 'Conferma dell\'email' })).toBeNull();
  });

  it('non c\'è da sloggati né prima che lo stato sia letto', () => {
    auth.isLoggedIn = false;
    const { container, rerender } = strip();
    expect(container.innerHTML).toBe('');
    auth.isLoggedIn = true;
    auth.emailState = null;
    rerender(<EmailStrip />);
    expect(container.innerHTML).toBe('');
  });
});

describe('promemoria del giorno', () => {
  it('all\'apertura dell\'app apre la finestra e ricorda che oggi è stato mostrato', () => {
    const view = mountGate();
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
    view.rerender(<EmailGate />);
    expect(dialog()).toBeTruthy();
    expect(localStorage.getItem('lx_email_reminder_7')).toBe(today());
  });

  it('una volta al giorno: se oggi è già stata mostrata non si riapre', () => {
    localStorage.setItem('lx_email_reminder_7', today());
    mountGate();
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
  });

  it('il giorno dopo si apre di nuovo', () => {
    localStorage.setItem('lx_email_reminder_7', '2020-01-01');
    mountGate();
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it('la memoria è per utente', () => {
    localStorage.setItem('lx_email_reminder_8', today());
    mountGate();
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it('una sola valutazione per apertura dell\'app: tornare alla pagina non la riapre', () => {
    const view = mountGate();
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
    localStorage.removeItem('lx_email_reminder_7');
    auth.emailDialogOpen = false;
    view.unmount();
    mountGate();
    expect(auth.openEmailDialog).toHaveBeenCalledTimes(1);
  });

  it('già mostrata dopo la registrazione: lo stesso giorno non si ripresenta', () => {
    auth.emailDialogOpen = true; // aperta da Register
    const view = mountGate();
    view.rerender(<EmailGate />);
    expect(dialog()).toBeTruthy();
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
    expect(localStorage.getItem('lx_email_reminder_7')).toBe(today());
  });

  it('non sopra un allenamento Focus in corso: salta e non lo ricorda per oggi', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: { id: 3 }, selectedDayId: 3, startTime: 1000 }));
    mountGate();
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
    expect(localStorage.getItem('lx_email_reminder_7')).toBeNull();
  });

  it.each([
    ['email confermata', { verified: true, daysLeft: null }],
    ['app bloccata', { blocked: true, daysLeft: 0 }],
  ])('non parte con %s', (_name, extra) => {
    auth.emailState = state(extra);
    mountGate();
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
  });

  it('non parte da sloggati', () => {
    auth.isLoggedIn = false;
    mountGate();
    expect(auth.openEmailDialog).not.toHaveBeenCalled();
  });
});

describe('finestra', () => {
  it('«Più tardi» la chiude', () => {
    auth.emailDialogOpen = true;
    const view = mountGate();
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    expect(auth.closeEmailDialog).toHaveBeenCalled();
    view.rerender(<EmailGate />);
  });

  it('il campo del codice ha il focus all\'apertura', () => {
    auth.emailDialogOpen = true;
    mountGate();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Codice di 6 cifre/));
  });

  it('con l\'app bloccata non c\'è la finestra: il codice si scrive nella schermata di blocco', () => {
    auth.emailDialogOpen = true;
    auth.emailState = state({ blocked: true, daysLeft: 0 });
    mountGate();
    expect(dialog()).toBeNull();
  });

  it('un cambio di indirizzo in attesa su un account confermato la apre per il nuovo indirizzo', () => {
    auth.emailDialogOpen = true;
    auth.emailState = state({ verified: true, daysLeft: null, pendingEmail: 'nuovo@example.com' });
    mountGate();
    expect(dialog()).toBeTruthy();
    expect(screen.getByText(/nuovo@example\.com/)).toBeTruthy();
  });

  it('se non c\'è più nulla da confermare il flag acceso viene spento', () => {
    auth.emailDialogOpen = true;
    auth.emailState = state({ verified: true, daysLeft: null });
    mountGate();
    expect(dialog()).toBeNull();
    expect(auth.closeEmailDialog).toHaveBeenCalled();
  });
});

describe('avviso di esito', () => {
  it('quando lo stato passa a confermata compare l\'avviso di successo', () => {
    const view = mountGate();
    expect(screen.queryByText('Email confermata.')).toBeNull();
    auth.emailState = state({ verified: true, daysLeft: null });
    view.rerender(<EmailGate />);
    expect(screen.getByText('Email confermata.')).toBeTruthy();
  });

  it('quando l\'indirizzo in attesa diventa quello dell\'account lo dice con il nuovo indirizzo', () => {
    auth.emailState = state({ verified: true, daysLeft: null, pendingEmail: 'nuovo@example.com' });
    const view = mountGate();
    auth.emailState = state({ verified: true, daysLeft: null, email: 'nuovo@example.com', pendingEmail: null });
    view.rerender(<EmailGate />);
    expect(screen.getByText('Indirizzo email aggiornato: nuovo@example.com.')).toBeTruthy();
  });

  it('l\'annullamento di un cambio in attesa non è una conferma: nessun avviso', () => {
    auth.emailState = state({ verified: true, daysLeft: null, pendingEmail: 'nuovo@example.com' });
    const view = mountGate();
    auth.emailState = state({ verified: true, daysLeft: null, pendingEmail: null });
    view.rerender(<EmailGate />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

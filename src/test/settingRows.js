import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

// Gli aiuti comuni ai test delle righe e delle finestre delle impostazioni («Profilo e preferenze», gli strumenti della
// serie prima dell'allenamento): la fetch è quella finta del test (`fetch.mock.calls`).

// La riga di un'impostazione (un pulsante) col suo nome
export const row = (name) => screen.getByRole('button', { name });
// La finestra col suo titolo, per leggerci dentro
export const dialogOf = (name) => within(screen.getByRole('dialog', { name }));
// Apre la finestra di una riga e la ritorna
export const open = (name) => { fireEvent.click(row(name)); return dialogOf(name); };
export const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
// Una finestra che si sta chiudendo resta nel documento per la dissolvenza, ma il fuoco è già tornato sulla riga: aperta
// davvero vuol dire che il fuoco è ancora dentro
export const staysOpen = () => {
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(document.activeElement.closest('.MuiDialog-root')).not.toBeNull();
};
// I corpi inviati a update_settings.php, nell'ordine
export const settingsCalls = () => fetch.mock.calls.filter(([url]) => String(url).includes('update_settings.php')).map(([, init]) => JSON.parse(init.body));
export const reads = () => fetch.mock.calls.filter(([url]) => String(url).includes('user/read.php')).length;

// Una risposta che arriva quando si chiama resolve(valore): la richiesta resta in corso finché non si vuole
export const deferred = () => {
  const control = {};
  control.promise = new Promise((resolve) => { control.resolve = resolve; });
  return control;
};

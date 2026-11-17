// Finestra «Elimina account»: stesso flusso e stesse conferme in Account e nella schermata di conferma email.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteAccountDialog from './DeleteAccountDialog';

const reply = (status, body) => vi.fn(() => Promise.resolve({ ok: status < 400, status, json: async () => body }));
const mount = (props = {}) => {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(<DeleteAccountDialog open onClose={onClose} onDeleted={onDeleted} {...props} />);
  return { onClose, onDeleted };
};
const confirmCheckbox = () => screen.getByRole('checkbox', { name: /Confermo di essere consapevole/ });
const deleteButton = () => screen.getByRole('button', { name: 'Elimina account' });

afterEach(() => vi.unstubAllGlobals());

describe('DeleteAccountDialog', () => {
  it('il bottone resta spento finché non si spunta la conferma', () => {
    mount();
    expect(deleteButton().disabled).toBe(true);
    fireEvent.click(confirmCheckbox());
    expect(deleteButton().disabled).toBe(false);
  });

  it('senza password non chiama il server e lo dice', () => {
    const fetchMock = reply(200, { success: true });
    vi.stubGlobal('fetch', fetchMock);
    mount();
    fireEvent.click(confirmCheckbox());
    fireEvent.click(deleteButton());
    expect(screen.getByText('La password è obbligatoria')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con password e conferma elimina: manda la password, chiude e avvisa', async () => {
    const fetchMock = reply(200, { success: true });
    vi.stubGlobal('fetch', fetchMock);
    const { onClose, onDeleted } = mount();
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Segreta!2026' } });
    fireEvent.click(confirmCheckbox());
    fireEvent.click(deleteButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('api/user/delete.php');
    expect(JSON.parse(init.body)).toEqual({ password: 'Segreta!2026' });
  });

  it('password sbagliata: mostra il messaggio del server e resta aperta', async () => {
    vi.stubGlobal('fetch', reply(400, { success: false, message: 'Password non corretta.' }));
    const { onDeleted } = mount();
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'sbagliata' } });
    fireEvent.click(confirmCheckbox());
    fireEvent.click(deleteButton());
    expect(await screen.findByText('Password non corretta.')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

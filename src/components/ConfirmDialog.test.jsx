// Finestra di conferma condivisa: l'azione parte una volta sola, anche con un secondo tocco mentre la finestra si chiude.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const dialogo = (open, onConfirm) => (
  <ConfirmDialog open={open} title="Eliminare la misurazione?" text="Non si può annullare." cta="Elimina" onConfirm={onConfirm} onClose={() => {}} />
);

describe('ConfirmDialog', () => {
  it('mentre la finestra si chiude il pulsante dell\'azione resta acceso ma un altro tocco non la rilancia', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(dialogo(true, onConfirm));
    const elimina = screen.getByRole('button', { name: 'Elimina' });
    fireEvent.click(elimina);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(dialogo(false, onConfirm));
    // La dissolvenza è in corso: il pulsante è ancora nella pagina e non è spento (non cambia colore mentre sparisce)
    expect(elimina.isConnected).toBe(true);
    expect(elimina.disabled).toBe(false);
    fireEvent.click(elimina);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// L'errore di lettura comune alle tre tab dei Progressi: testo, «Riprova» che chiama il comando, area da 44px.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoadError from './LoadError';

describe('LoadError', () => {
  it('mostra il testo come avviso d\'errore con «Riprova», che chiama il comando', () => {
    const onRetry = vi.fn();
    render(<LoadError message="Non riesco a leggere i dati" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toBe('Non riesco a leggere i datiRiprova');
    const retry = screen.getByRole('button', { name: 'Riprova' });
    expect(getComputedStyle(retry).minHeight).toBe('44px');
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

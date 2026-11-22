// Riga di un muscolo del piano Gratis: solo il nome, o nome con pallino e stato scritto (tab Volume).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BasicMuscleRow from './BasicMuscleRow';
import { ThemeModeProvider } from '../context/ThemeModeContext';

const mount = (props) => render(<ThemeModeProvider><ul><BasicMuscleRow muscle="petto" {...props} /></ul></ThemeModeProvider>);

describe('riga Gratis', () => {
  it('senza etichetta c\'è solo il nome, a 16 px (card della Home)', () => {
    mount({});
    expect(getComputedStyle(screen.getByText('Petto')).fontSize).toBe('16px');
    expect(screen.getByRole('listitem').textContent).toBe('Petto');
  });

  it('con l\'etichetta c\'è lo stato scritto, a 16 px, e «Puoi allenare» è verde e semigrassetto', () => {
    mount({ status: 'PRONTO', label: 'Puoi allenare' });
    const label = screen.getByText('Puoi allenare');
    expect(getComputedStyle(label).fontSize).toBe('16px');
    expect(getComputedStyle(label).fontWeight).toBe('600');
    expect(getComputedStyle(label).color).toBe('rgb(21, 128, 61)');
  });

  it('il pallino è tondo dal tema (pill)', () => {
    mount({ status: 'PRONTO', label: 'Puoi allenare' });
    const dot = screen.getByRole('listitem').firstElementChild;
    expect(getComputedStyle(dot).borderRadius).toBe('999px');
  });
});

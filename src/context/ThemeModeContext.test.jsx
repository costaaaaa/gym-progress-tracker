// Font dei chip, uguale all'app: Lexend 500 su quelli che si premono, i badge restano Inter.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip } from '@mui/material';
import { ThemeModeProvider } from './ThemeModeContext';

const font = (label) => {
  const { fontFamily, fontWeight } = getComputedStyle(screen.getByText(label).closest('.MuiChip-root'));
  return { fontFamily, fontWeight };
};

describe('tema: chip', () => {
  it('un chip che si preme è in Lexend 500', () => {
    render(<ThemeModeProvider><Chip label="3M" onClick={() => {}} /></ThemeModeProvider>);
    expect(font('3M')).toEqual({ fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
  });

  it('un badge resta Inter', () => {
    render(<ThemeModeProvider><Chip label="PR" /></ThemeModeProvider>);
    expect(font('PR').fontFamily).toMatch(/^"Inter"/);
  });
});

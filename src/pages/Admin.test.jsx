// Area admin: il titolo del documento è tradotto come quello delle altre pagine.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Admin from './Admin';

vi.mock('../components/Groups/RequireLogin', () => ({ default: () => null }));

describe('titolo della pagina', () => {
  it('«Amministrazione | LiftIndex»', () => {
    render(<Admin />);
    expect(document.title).toBe('Amministrazione | LiftIndex');
  });
});

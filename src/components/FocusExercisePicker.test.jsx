// Picker del Focus: l'attrezzo si legge nella lingua dell'utente, mai come slug grezzo ("corpo_libero").
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import i18n from '../i18n';
import FocusExercisePicker from './FocusExercisePicker';
import { json } from '../test/dom';

const CATALOG = [{ id: 20, name: 'Plank', muscle_group: 'addome', equipment: 'corpo_libero' }];

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: CATALOG })))); });
afterEach(() => { vi.unstubAllGlobals(); });

const apri = async () => {
  render(<FocusExercisePicker open mode="add" onClose={() => {}} onPick={() => {}} />);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

describe('FocusExercisePicker · attrezzo', () => {
  it('nella lista e nell\'esercizio scelto mostra l\'etichetta in italiano, non lo slug', async () => {
    await apri();
    expect(screen.getByText(/Corpo libero/)).toBeTruthy();
    expect(screen.queryByText(/corpo_libero/)).toBeNull();
    fireEvent.click(screen.getByText('Plank'));
    expect(screen.getByText(/Corpo libero/)).toBeTruthy();
    expect(screen.queryByText(/corpo_libero/)).toBeNull();
  });

  it('in inglese mostra l\'etichetta inglese', async () => {
    await i18n.changeLanguage('en');
    await apri();
    expect(screen.getByText(/Bodyweight/)).toBeTruthy();
    fireEvent.click(screen.getByText('Plank'));
    expect(screen.getByText(/Bodyweight/)).toBeTruthy();
    expect(screen.queryByText(/corpo_libero/)).toBeNull();
  });
});

// Scelta del giorno: il gruppo resta raggiungibile da tastiera anche con un id scelto che non è fra i giorni
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import SelectDayPhase from './SelectDayPhase';

const noop = () => {};
const plan = { id: 1, name: 'Scheda', days: [{ id: 1, name: 'Push', exercises: [] }, { id: 2, name: 'Pull', exercises: [] }] };
const renderPhase = (selectedDayId) => render(
  <MemoryRouter><ThemeModeProvider>
    <SelectDayPhase activePlan={plan} selectedDayId={selectedDayId} selectedDay={null} timerEnabled
      onDayChange={noop} onStart={noop} onBack={noop} onGoToPlans={noop} />
  </ThemeModeProvider></MemoryRouter>,
);

describe('ordine di Tab sulle etichette dei giorni', () => {
  it('un id scelto che non è fra i giorni lascia la prima etichetta nell\'ordine di Tab', () => {
    renderPhase(99);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1]);
  });

  it('con un giorno scelto è quello nell\'ordine di Tab', () => {
    renderPhase(2);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, 0]);
  });
});

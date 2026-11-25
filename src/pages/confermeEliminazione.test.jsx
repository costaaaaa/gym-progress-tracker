// Le conferme di un'eliminazione hanno tutte lo stesso aspetto: «Elimina» rosso pieno senza icona e il testo del corpo
// a 16 px nel colore del testo principale (non grigio). Qui i dialog che si montano da soli; quelli dentro una pagina
// (gruppo, revoca del consenso) sono provati nei test della loro pagina.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import DeleteDayDialog from './plans/DeleteDayDialog';
import DeleteExerciseDialog from './plans/DeleteExerciseDialog';
import DeletePlanDialog from './plans/DeletePlanDialog';
import DeleteWorkoutDialog from './history/DeleteWorkoutDialog';
import DeleteAccountDialog from '../components/Account/DeleteAccountDialog';
import { colorOf } from '../test/dom';

const INK = 'rgb(26, 24, 22)';
const RED = 'rgb(213, 0, 0)';
const noop = () => {};
const mount = (ui) => render(<ThemeModeProvider>{ui}</ThemeModeProvider>);

const expectConfirm = (corpo, conferma) => {
  const dialog = within(screen.getByRole('dialog'));
  const bottone = dialog.getByRole('button', { name: conferma });
  expect(bottone.querySelector('svg')).toBeNull();
  expect(bottone.classList.contains('MuiButton-containedError')).toBe(true);
  expect(getComputedStyle(bottone).backgroundColor).toBe(RED);
  const testo = dialog.getByText(corpo);
  expect(colorOf(testo)).toBe(INK);
  expect(getComputedStyle(testo).fontSize).toBe('16px');
};

describe('conferme di eliminazione', () => {
  it('giorno', () => {
    mount(<DeleteDayDialog day={{ id: 1, name: 'Giorno A' }} features={[]} onClose={noop} onDelete={noop} />);
    expectConfirm('Gli esercizi di questo giorno verranno eliminati. L\'azione è irreversibile.', 'Elimina');
  });

  it('esercizio', () => {
    mount(<DeleteExerciseDialog open target={{ dayId: 1, exercise: { id: 2, name: 'Panca' } }} onClose={noop} onDelete={noop} />);
    expectConfirm('Sei sicuro di voler eliminare questo esercizio? L\'azione è irreversibile.', 'Elimina');
  });

  it('scheda', () => {
    mount(<DeletePlanDialog open plan={{ id: 1, name: 'A', is_active: 0 }} onClose={noop} onDelete={noop} readGoalAfterDelete={noop} />);
    expectConfirm('Sei sicuro di voler eliminare questa scheda? L\'azione è irreversibile.', 'Elimina');
  });

  it('allenamento: anche le righe su cosa si perde sono a 16 px', async () => {
    mount(<DeleteWorkoutDialog workout={{ id: 1 }} onClose={noop} onConfirm={noop} showLevels weightUnit="kg"
      previewDelete={vi.fn(() => Promise.resolve({ success: true, xp_removed: 40, streak_before: 3, streak_after: 2, achievements_removed: [] }))} />);
    expectConfirm('Sei sicuro di voler eliminare questo allenamento?', 'Elimina');
    const xp = await screen.findByText('Perderai 40 XP.');
    expect(getComputedStyle(xp).fontSize).toBe('16px');
    expect(colorOf(xp)).toBe(INK);
    expect(getComputedStyle(screen.getByText('Lo streak passa da 3 a 2 settimane.')).fontSize).toBe('16px');
  });

  it('account', () => {
    mount(<DeleteAccountDialog open onClose={noop} onDeleted={noop} />);
    // Spento finché non si spunta la conferma, e da spento non è rosso
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo di essere consapevole/ }));
    expectConfirm(/Stai per eliminare definitivamente il tuo account/, 'Elimina account');
    // Anche l'avviso nel riquadro giallo fa parte del corpo
    ['Attenzione: questa azione è irreversibile!', 'Tutti i tuoi dati, inclusi allenamenti e schede, verranno eliminati permanentemente.']
      .forEach((testo) => expect(getComputedStyle(screen.getByText(testo)).fontSize).toBe('16px'));
  });
});

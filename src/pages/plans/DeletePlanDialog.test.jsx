// Conferma di eliminazione di una scheda, a livello del dialog: la risposta tardiva sull'obiettivo settimanale
// (arrivata per un'altra scheda o dopo la chiusura) non deve comparire. Nessuna schermata cambia la scheda con
// il dialog aperto, quindi la protezione si prova solo qui, cambiando le prop.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DeletePlanDialog from './DeletePlanDialog';

const goalText = (n) => `L'obiettivo della settimana tornerà a quello predefinito (${n} allenamenti).`;
const planA = { id: 1, name: 'A', is_active: 1 };
const planB = { id: 2, name: 'B', is_active: 1 };

// readGoalAfterDelete che risponde quando lo si decide: una funzione di risposta per ogni chiamata
const pending = () => {
  const answers = [];
  const readGoalAfterDelete = vi.fn(() => new Promise((resolve) => { answers.push(resolve); }));
  return { answers, readGoalAfterDelete };
};
const dialog = (props) => <DeletePlanDialog open plan={planA} onClose={() => {}} onDelete={async () => true} {...props} />;

describe('risposta tardiva sull\'obiettivo', () => {
  it('quella arrivata per un\'altra scheda non si vede; vale solo la risposta della scheda in corso', async () => {
    const { answers, readGoalAfterDelete } = pending();
    const { rerender } = render(dialog({ readGoalAfterDelete }));
    rerender(dialog({ plan: planB, readGoalAfterDelete }));
    expect(answers).toHaveLength(2);
    await act(async () => { answers[0](7); });
    expect(screen.queryByText(goalText(7))).toBeNull();
    await act(async () => { answers[1](3); });
    expect(screen.getByText(goalText(3))).toBeTruthy();
  });

  it('quella arrivata dopo la chiusura non si vede', async () => {
    const { answers, readGoalAfterDelete } = pending();
    const { rerender } = render(dialog({ readGoalAfterDelete }));
    rerender(dialog({ open: false, readGoalAfterDelete }));
    // Durante la dissolvenza il contenuto è ancora nel documento: solo così la risposta potrebbe mostrarsi
    expect(screen.getByText('Conferma eliminazione scheda')).toBeTruthy();
    await act(async () => { answers[0](5); });
    expect(screen.queryByText(goalText(5))).toBeNull();
  });
});

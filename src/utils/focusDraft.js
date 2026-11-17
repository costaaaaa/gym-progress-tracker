// Bozza dell'allenamento Focus salvata su questo browser (chiave e lettura). Vive qui, e non in
// pages/focus, perché la leggono anche il layout (promemoria dell'email) e la pagina Schede.
export const DRAFT_STORAGE_KEY = 'gym_focus_workout_draft';

// Id del giorno di scheda dell'allenamento salvato su questo browser (la bozza), o null se non c'è.
export const savedDraftDayId = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY))?.selectedDayId ?? null;
  } catch {
    return null;
  }
};

// C'è un allenamento Focus in corso su questo browser? Stessa condizione con cui Focus propone la ripresa.
export const hasFocusSessionInProgress = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY));
    return Boolean(draft?.selectedDay && draft?.startTime);
  } catch {
    return false;
  }
};

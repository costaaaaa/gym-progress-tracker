// Tecniche di intensità che si possono SCEGLIERE (Focus, editor della scheda, «Registra allenamento passato»).
// I valori sono quelli salvati nei dati, in italiano. Le altre tecniche di un tempo restano leggibili
// (labels.js le traduce tutte) ma non si offrono più. File puro, senza import: stessa logica nell'altro client.
export const NO_TECHNIQUE = 'Nessuna (Normale)';

export const SELECTABLE_TECHNIQUES = ['Drop Set (Stripping)', 'Rest Pause', 'Myo-Reps', 'Negative'];

export const isSelectableTechnique = (value) => SELECTABLE_TECHNIQUES.includes(value);

// Voci di una tendina con `current` come valore attuale: le quattro, più `current` in coda se è una tecnica tolta
// (scheda vecchia). Cambiato il valore, la voce sparisce: non si può riscegliere.
export const techniqueChoices = (current) => (
  current && current !== NO_TECHNIQUE && !isSelectableTechnique(current)
    ? [...SELECTABLE_TECHNIQUES, current]
    : SELECTABLE_TECHNIQUES
);

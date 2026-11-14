// Attrezzi di gym_exercises.equipment (slug salvati nel database) con l'etichetta mostrata.
export const EQUIPMENT_LABELS = {
  bilanciere: 'Bilanciere',
  manubri: 'Manubri',
  cavi: 'Cavi',
  macchina: 'Macchina',
  multipower: 'Multipower',
  corpo_libero: 'Corpo libero',
  kettlebell: 'Kettlebell',
};

export const equipmentLabel = (slug) => EQUIPMENT_LABELS[slug] || null;

const isWordChar = (ch) => /[\p{L}\p{N}]/u.test(ch);

// Pertinenza di un esercizio per il testo cercato (stessa normalizzazione di exerciseMatches):
// 0 = un nome è uguale, 1 = inizia con il testo, 2 = una parola inizia con il testo, 3 = lo contiene.
// Vince il migliore tra name, name_it e name_en; null se non c'è corrispondenza.
export const exerciseRank = (exercise, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let best = null;
  for (const raw of [exercise.name, exercise.name_it, exercise.name_en]) {
    const name = (raw || '').toLowerCase();
    const at = name.indexOf(q);
    if (at === -1) continue;
    let rank = 3;
    if (name === q) rank = 0;
    else if (at === 0) rank = 1;
    else {
      for (let i = at; i !== -1; i = name.indexOf(q, i + 1)) {
        if (!isWordChar(name[i - 1])) { rank = 2; break; }
      }
    }
    if (best === null || rank < best) best = rank;
  }
  return best;
};

// True se il testo cercato compare nel nome mostrato, in quello italiano o in quello inglese
export const exerciseMatches = (exercise, query) => exerciseRank(exercise, query) !== null;

// Con un testo cercato: gli esercizi che corrispondono, in ordine di pertinenza e poi di nome.
// Senza testo: l'elenco com'è.
export const rankExerciseMatches = (exercises, query) => {
  if (!query.trim()) return exercises;
  return exercises
    .map((exercise) => ({ exercise, rank: exerciseRank(exercise, query) }))
    .filter(({ rank }) => rank !== null)
    .sort((a, b) => a.rank - b.rank || (a.exercise.name || '').localeCompare(b.exercise.name || ''))
    .map(({ exercise }) => exercise);
};

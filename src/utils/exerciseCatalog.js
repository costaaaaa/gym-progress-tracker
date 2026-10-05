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

// True se il testo cercato compare nel nome mostrato, in quello italiano o in quello inglese
export const exerciseMatches = (exercise, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [exercise.name, exercise.name_it, exercise.name_en].some((n) => (n || '').toLowerCase().includes(q));
};

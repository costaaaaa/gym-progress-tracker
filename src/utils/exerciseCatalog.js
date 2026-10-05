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

// True se il testo cercato compare nel nome italiano o in quello inglese
export const exerciseMatches = (exercise, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return exercise.name.toLowerCase().includes(q) || (exercise.name_en || '').toLowerCase().includes(q);
};

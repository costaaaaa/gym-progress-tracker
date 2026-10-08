import i18n from './index';

// muscle_group è una chiave del catalogo (es. 'petto'); se manca la traduzione resta il valore.
export const muscleLabel = (group) => {
  if (!group) return '';
  const fallback = group.charAt(0).toUpperCase() + group.slice(1);
  return i18n.t(`muscle.${group.toLowerCase()}`, { defaultValue: fallback });
};

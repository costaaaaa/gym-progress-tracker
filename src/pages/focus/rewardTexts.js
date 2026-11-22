import { unlockedAchievementsText } from './unlockedAchievementsText';

// Livello nuovo e traguardi nuovi dopo il salvataggio: stessi testi nel riquadro del riepilogo e nell'annuncio a voce.
// Stringa vuota se la risposta non li ha.
export const levelReachedText = (t, result) => (result?.leveled_up ? t('focus.level_reached', { level: result.new_level }) : '');

export const newAchievementsText = (t, result, weightUnit) => {
  const unlocked = result?.unlocked_achievements;
  return unlocked?.length ? t('focus.new_achievements', { count: unlocked.length, labels: unlockedAchievementsText(unlocked, weightUnit) }) : '';
};

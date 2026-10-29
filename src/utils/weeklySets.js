import { MUSCLE_GROUPS } from './recoveryGroups';

// Totale delle serie di un blocco di weekly_sets (week o previous_to_date) sui muscoli contati.
// Il blocco manca sui server più vecchi (sicurezza del rollout): conta 0. Usato da Home e scheda Muscoli.
export const totalSets = (bucket) => MUSCLE_GROUPS.reduce((sum, m) => sum + (bucket?.[m] || 0), 0);

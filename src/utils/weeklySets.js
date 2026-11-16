import { MUSCLE_GROUPS } from './recoveryGroups';

// Totale delle serie di un blocco di weekly_sets (week o previous_to_date) sui muscoli contati.
// Il blocco manca sui server più vecchi (sicurezza del rollout): conta 0. Usato da Home e scheda Muscoli.
export const totalSets = (bucket) => MUSCLE_GROUPS.reduce((sum, m) => sum + (bucket?.[m] || 0), 0);

// Serie della settimana da weekly_sets: `total` (il solo campo che il piano Gratis riceve) se c'è, altrimenti
// la somma di week.
export const weeklyTotal = (weeklySets) => weeklySets?.total ?? totalSets(weeklySets?.week);

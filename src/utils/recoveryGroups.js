import { readyInDays } from './recoveryDay';

// Gruppi muscolari tracciati, nell'ordine del corpo (stesse chiavi di dashboardStats.recovery).
export const MUSCLE_GROUPS = [
  'petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'polpacci',
];

const clampPercent = (value) => (typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null);

// Divide lo stato di recupero in ciò che si può allenare, ciò che riposa (per giorni a pronto crescenti,
// a parità nell'ordine del corpo; senza giorno in fondo) e i gruppi senza uno stato valido.
export function groupRecovery(recoveryData, now = new Date()) {
  const canTrain = [];
  const resting = [];
  const noData = [];

  for (const group of MUSCLE_GROUPS) {
    const info = recoveryData?.[group];
    if (info?.status === 'PRONTO') {
      canTrain.push(group);
    } else if (info?.status === 'IN RECUPERO' || info?.status === 'AFFATICATO') {
      resting.push({ group, status: info.status, percent: clampPercent(info.percent), days: readyInDays(info.ready_at, now) });
    } else {
      noData.push(group);
    }
  }

  // sort è stabile: a parità di giorni resta l'ordine del corpo
  resting.sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
  return { canTrain, resting, noData };
}

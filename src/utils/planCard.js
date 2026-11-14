// Riepilogo di una scheda per la card chiusa: funzioni pure.
import { plannedOf, workingOf } from './plannedSets';

// Nome che l'app dà ai giorni quando crea la scheda ("Giorno 1"), o simili ("Giorno A", "Day 2")
const DEFAULT_DAY_NAME = /^(giorno|day)\s+(\d+|[a-z])$/i;
export const isDefaultDayName = (name) => DEFAULT_DAY_NAME.test(String(name ?? '').trim());

// Serie allenanti pianificate (il riscaldamento non conta)
export const workingSetsOfDay = (day) =>
  (day.exercises || []).reduce((n, exercise) => n + workingOf(plannedOf(exercise)).length, 0);

// Nomi dei giorni da mostrare sulla riga divisa, o null: servono da 2 a 4 giorni e almeno un nome scelto dall'utente
export const splitDayNames = (days) => {
  if (!days || days.length < 2 || days.length > 4) return null;
  if (days.every((day) => isDefaultDayName(day.name))) return null;
  return days.map((day) => day.name);
};

// { days, exercises, sets, splitNames }: con splitNames la riga dei conteggi omette i giorni
export const planCardSummary = (plan) => {
  const days = plan.days || [];
  return {
    days: days.length,
    exercises: days.reduce((n, day) => n + (day.exercises?.length || 0), 0),
    sets: days.reduce((n, day) => n + workingSetsOfDay(day), 0),
    splitNames: splitDayNames(days),
  };
};

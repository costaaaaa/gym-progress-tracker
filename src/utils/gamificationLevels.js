// Mirror di backend/lib/gamification_rules.php: livello generale unit 100, per esercizio unit 25
export const LEVEL_UNIT_GENERAL = 100;
export const LEVEL_UNIT_EXERCISE = 25;

export function xpForLevel(level, unit = LEVEL_UNIT_GENERAL) {
  if (level <= 1) return 0;
  return unit * (level - 1) ** 2;
}

export function levelForXp(xp, unit = LEVEL_UNIT_GENERAL) {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / unit)) + 1;
}

export function xpIntoLevel(xp, unit = LEVEL_UNIT_GENERAL) {
  const lvl = levelForXp(xp, unit);
  return xp - xpForLevel(lvl, unit);
}

export function xpForNextLevel(xp, unit = LEVEL_UNIT_GENERAL) {
  const lvl = levelForXp(xp, unit);
  return xpForLevel(lvl + 1, unit) - xpForLevel(lvl, unit);
}

// Perché una sessione non ha dato XP (xp_session_reason di record_workout.php); '' se li ha dati
// o se il backend è vecchio e non manda il campo. Soglie come in gamification_rules.php.
export function xpWithheldMessage(result) {
  if (!result || result.xp_session_awarded !== false) return '';
  switch (result.xp_session_reason) {
    case 'incomplete':
      return `Nessun XP di sessione: completato al ${result.completion_pct ?? 0}% della scheda, serve almeno il 60%.`;
    case 'too_short':
      return "Nessun XP di sessione: l'allenamento deve durare almeno 20 minuti.";
    case 'cooldown':
      return 'Nessun XP di sessione: se ne ottiene uno ogni 10 ore.';
    case 'no_plan':
      return 'Gli XP di sessione si ottengono sugli allenamenti di una scheda.';
    default:
      return '';
  }
}

export const achievementCatalog = [
  { key: 'sessions_10',      label: 'Prime 10 sessioni',        category: 'sessions',  threshold: 10 },
  { key: 'sessions_50',      label: '50 sessioni',               category: 'sessions',  threshold: 50 },
  { key: 'sessions_100',     label: 'Centurione',                category: 'sessions',  threshold: 100 },
  { key: 'sessions_250',     label: '250 sessioni',              category: 'sessions',  threshold: 250 },
  { key: 'tonnage_auto',     label: '1.500 kg sollevati',        category: 'tonnage',   threshold: 1500 },
  { key: 'tonnage_elephant', label: '6.000 kg — elefante',       category: 'tonnage',   threshold: 6000 },
  { key: 'tonnage_whale',    label: '50.000 kg — balena',        category: 'tonnage',   threshold: 50000 },
  { key: 'tonnage_bus',      label: '100.000 kg — autobus',      category: 'tonnage',   threshold: 100000 },
  { key: 'strength_60',      label: '60 kg in un esercizio',     category: 'strength',  threshold: 60 },
  { key: 'strength_100',     label: '100 kg in un esercizio',    category: 'strength',  threshold: 100 },
  { key: 'strength_140',     label: '140 kg in un esercizio',    category: 'strength',  threshold: 140 },
  { key: 'streak_4',         label: '4 settimane consecutive',   category: 'streak',    threshold: 4 },
  { key: 'streak_8',         label: '8 settimane consecutive',   category: 'streak',    threshold: 8 },
  { key: 'streak_12',        label: '12 settimane consecutive',  category: 'streak',    threshold: 12 },
  { key: 'streak_24',        label: '24 settimane consecutive',  category: 'streak',    threshold: 24 },
];

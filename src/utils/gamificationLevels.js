// Mirror di backend/lib/gamification_rules.php: livello generale unit 100
export const LEVEL_UNIT_GENERAL = 100;

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

export const achievementCatalog = [
  { key: 'sessions_10',      label: 'Prime 10 sessioni',        category: 'sessions',  threshold: 10 },
  { key: 'sessions_50',      label: '50 sessioni',               category: 'sessions',  threshold: 50 },
  { key: 'sessions_100',     label: 'Centurione',                category: 'sessions',  threshold: 100 },
  { key: 'sessions_250',     label: '250 sessioni',              category: 'sessions',  threshold: 250 },
  // Tonnellaggio: oggetti reali in ordine di peso, dalla prima sessione ad anni di allenamento
  { key: 'tonnage_auto',     label: '1,5 t — automobile',          category: 'tonnage',   threshold: 1500 },
  { key: 'tonnage_elephant', label: '6 t — elefante',              category: 'tonnage',   threshold: 6000 },
  { key: 'tonnage_bus',      label: '15 t — autobus',              category: 'tonnage',   threshold: 15000 },
  { key: 'tonnage_tank',     label: '60 t — carro armato',         category: 'tonnage',   threshold: 60000 },
  { key: 'tonnage_whale',    label: '150 t — balenottera azzurra', category: 'tonnage',   threshold: 150000 },
  { key: 'tonnage_iss',      label: '420 t — Stazione Spaziale',   category: 'tonnage',   threshold: 420000 },
  { key: 'tonnage_shuttle',  label: '2.000 t — Space Shuttle',     category: 'tonnage',   threshold: 2000000 },
  { key: 'tonnage_eiffel',   label: '7.300 t — Torre Eiffel',      category: 'tonnage',   threshold: 7300000 },
  { key: 'strength_60',      label: '60 kg in un esercizio',     category: 'strength',  threshold: 60 },
  { key: 'strength_100',     label: '100 kg in un esercizio',    category: 'strength',  threshold: 100 },
  { key: 'strength_140',     label: '140 kg in un esercizio',    category: 'strength',  threshold: 140 },
  { key: 'streak_4',         label: '4 settimane consecutive',   category: 'streak',    threshold: 4 },
  { key: 'streak_8',         label: '8 settimane consecutive',   category: 'streak',    threshold: 8 },
  { key: 'streak_12',        label: '12 settimane consecutive',  category: 'streak',    threshold: 12 },
  { key: 'streak_24',        label: '24 settimane consecutive',  category: 'streak',    threshold: 24 },
];

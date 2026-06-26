export function xpForLevel(level) {
  if (level <= 1) return 0;
  return 100 * (level - 1) ** 2;
}

export function levelForXp(xp) {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpIntoLevel(xp) {
  const lvl = levelForXp(xp);
  return xp - xpForLevel(lvl);
}

export function xpForNextLevel(xp) {
  const lvl = levelForXp(xp);
  return xpForLevel(lvl + 1) - xpForLevel(lvl);
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

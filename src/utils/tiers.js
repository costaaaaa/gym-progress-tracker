// Nomi dei livelli e giorni scritti, in italiano: usati da Registrazione, Account e dall'area admin.

export const TIER_NAMES = { plus: 'Plus', pro: 'Pro' };
export const tierName = (tier) => TIER_NAMES[tier] ?? tier;

// "2026-12-31" → "31/12/2026", senza passare da Date (niente fusi)
export const formatDay = (day) => day.split('-').reverse().join('/');

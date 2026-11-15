// Valori plausibili delle misure corporee: le stesse regole di backend/lib/stats_rules.php (STATS_LIMITS), nell'ordine
// dei campi del modulo. Il server controlla sempre; qui si segnala l'errore prima di inviare.
// Estremi inclusi: da 0 al tetto.
export const BODY_LIMITS = {
  weight: 500, body_fat_percentage: 100, muscle_mass_percentage: 100,
  chest_size: 300, arm_size: 150, waist_size: 300, leg_size: 200,
};

// Vuoto è ammesso (campo non compilato); altrimenti serve un numero finito da 0 a max
export const isValueOutOfRange = (value, max) => value !== '' && !(Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max);

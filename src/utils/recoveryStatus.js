// Stato di recupero grezzo dal backend (PRONTO / IN RECUPERO / AFFATICATO) → colore del tema
// (palette.recovery) e testo "pronto oggi/domani/tra N giorni". Condiviso da BodyVisualizer
// (card Stato muscolare) e dalla scheda Muscoli.
export const STATUS_COLOR = {
  PRONTO: 'recovery.ready',
  'IN RECUPERO': 'recovery.recovering',
  AFFATICATO: 'recovery.fatigued',
};

// "pronto oggi" / "pronto domani" / "pronto tra N giorni": mai l'ora, il calcolo è una stima.
export const readyLabel = (t, days) => {
  if (days === 0) return t('recovery.ready_today');
  if (days === 1) return t('recovery.ready_tomorrow');
  return t('recovery.ready_in_days', { count: days });
};

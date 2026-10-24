import { MUSCLE_GROUPS } from './recoveryGroups';

// Stato muscolare di esempio per la home pubblica e le pagine di accesso.
// Esempi precalcolati a circa 24 ore dall'allenamento: [stato, percentuale, giorni al "pronto"].
// Non c'è nessuna formula nel client: sono dati di esempio, dichiarati tali sotto la card.
const R = ['PRONTO', 100, 0];
const SETS = {
  none: {},
  push: { petto: ['AFFATICATO', 30, 3], spalle: ['IN RECUPERO', 50, 2], tricipiti: ['IN RECUPERO', 55, 1] },
  pull: { schiena: ['AFFATICATO', 32, 2], bicipiti: ['IN RECUPERO', 55, 1], spalle: ['IN RECUPERO', 70, 1] },
  legs: {
    quadricipiti: ['AFFATICATO', 28, 3],
    glutei: ['IN RECUPERO', 45, 2],
    femorali: ['IN RECUPERO', 40, 2],
    polpacci: ['IN RECUPERO', 60, 1],
  },
};

const pad = (n) => String(n).padStart(2, '0');
const toReadyAt = (days) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

export const buildRecovery = (option) =>
  Object.fromEntries(
    MUSCLE_GROUPS.map((m) => {
      const [status, percent, days] = SETS[option][m] || R;
      return [m, { status, percent, ready_at: days ? toReadyAt(days) : null }];
    }),
  );

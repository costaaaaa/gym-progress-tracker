// PROTOTIPO USA E GETTA (tracker #18): dati finti in memoria, nessun fetch.
// Serie deterministica; "oggi" = data reale dell'esecuzione.
// Segmenti: manuali ogni ~3 giorni (da -14 a -10 mesi), Apple Salute quasi ogni giorno
// (da -10 a -5 mesi), buco di 2 mesi (-5 / -3), Apple Salute fino a oggi.

const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const addMonths = (d, n) => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  r.setHours(12, 0, 0, 0);
  return r;
};

let seed = 18;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const noise = (amp) => (rnd() - 0.5) * 2 * amp;

const blank = {
  weight: null, body_fat_percentage: null, muscle_mass_percentage: null,
  chest_size: null, arm_size: null, waist_size: null, leg_size: null, health_fields: null,
};

export const buildRows = (mode = 'recent') => {
  seed = 18;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const t0 = addMonths(today, -14);
  const manualEnd = addMonths(today, -10);
  const gapStart = addMonths(today, -5);
  const gapEnd = addMonths(today, -3);
  const total = Math.round((today - t0) / 86400000);
  const rows = [];
  let id = 1;
  for (let i = 0; i <= total; i++) {
    const day = addDays(t0, i);
    const iso = toIso(day);
    const p = i / total;
    const base = 82 - 4 * p; // 82 -> 78 kg
    if (day >= gapStart && day < gapEnd) continue;
    if (day < manualEnd) {
      if (i % 3 !== 0) continue;
      const circ = i % 30 === 0;
      rows.push({
        ...blank, id: id++, date: iso, weight: (base + noise(0.5)).toFixed(1),
        ...(circ ? {
          body_fat_percentage: (19 - 2 * p + noise(0.4)).toFixed(1),
          muscle_mass_percentage: (40 + noise(0.4)).toFixed(1),
          chest_size: (100 + noise(1)).toFixed(1), waist_size: (87 - 3 * p + noise(0.8)).toFixed(1),
          arm_size: (35 + noise(0.4)).toFixed(1), leg_size: (58 + noise(0.6)).toFixed(1),
        } : {}),
      });
      continue;
    }
    if (rnd() < 0.05) continue;
    const withFat = rnd() < 0.3;
    rows.push({
      ...blank, id: id++, date: iso, weight: (base + noise(0.6)).toFixed(1),
      body_fat_percentage: withFat ? (17.5 - 2 * p + noise(0.4)).toFixed(1) : null,
      health_fields: withFat ? 'weight,body_fat_percentage' : 'weight',
    });
    // ogni ~2 settimane una riga manuale con le circonferenze, stesso giorno
    if (i % 14 === 0) {
      rows.push({
        ...blank, id: id++, date: iso,
        chest_size: (101 + noise(0.8)).toFixed(1), waist_size: (84 - 2 * p + noise(0.8)).toFixed(1),
        arm_size: (36 + noise(0.3)).toFixed(1), leg_size: (59 + noise(0.5)).toFixed(1),
        muscle_mass_percentage: (41 + noise(0.5)).toFixed(1),
      });
    }
  }
  if (mode === 'old') {
    const cut = toIso(gapStart);
    const old = rows.filter((r) => r.date <= cut);
    // l'ultima riga ha solo una circonferenza, niente peso
    const last = old[old.length - 1];
    Object.assign(last, { ...blank, id: last.id, date: last.date, waist_size: '84.5', chest_size: '100.2' });
    return old;
  }
  return rows;
};

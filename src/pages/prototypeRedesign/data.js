// PROTOTIPO (da buttare): dati finti di tutte le schermate
export const DAYS = [
  { name: 'Giorno A · Push', ex: [['Panca piana', '4 × 8'], ['Military press', '3 × 10'], ['Croci ai cavi', '3 × 12'], ['Alzate laterali', '3 × 15'], ['Pushdown ai cavi', '3 × 12'], ['Dip alle parallele', '3 × 10']] },
  { name: 'Giorno B · Pull', ex: [['Trazioni assistite', '3 × 8'], ['Lat machine presa larga', '4 × 10'], ['Rematore con manubrio', '3 × 10'], ['Pulley basso', '3 × 12'], ['Face pull', '3 × 15'], ['Curl con manubri', '3 × 12']] },
  { name: 'Giorno C · Legs', ex: [['Squat', '4 × 6'], ['Pressa', '3 × 10'], ['Stacco rumeno', '3 × 8'], ['Leg curl', '3 × 12'], ['Calf in piedi', '4 × 15']] },
];

export const PLANS = [
  { id: 1, name: 'Push Pull Legs', days: DAYS },
  { id: 2, name: 'Full body', days: [{ name: 'Giorno 1', ex: [['Squat', '3 × 8'], ['Panca piana', '3 × 8'], ['Rematore con manubrio', '3 × 10'], ['Plank', '3 × 45 s']] }, { name: 'Giorno 2', ex: [['Stacco rumeno', '3 × 8'], ['Military press', '3 × 10'], ['Lat machine presa larga', '3 × 10']] }, { name: 'Giorno 3', ex: [['Pressa', '3 × 10'], ['Dip alle parallele', '3 × 10'], ['Pulley basso', '3 × 12']] }] },
  { id: 3, name: 'Upper Lower', days: [{ name: 'Upper 1', ex: [['Panca piana', '4 × 6'], ['Rematore con manubrio', '4 × 8']] }, { name: 'Lower 1', ex: [['Squat', '4 × 6'], ['Leg curl', '3 × 12']] }, { name: 'Upper 2', ex: [['Military press', '4 × 8'], ['Trazioni assistite', '4 × 8']] }, { name: 'Lower 2', ex: [['Stacco rumeno', '4 × 6'], ['Calf in piedi', '4 × 15']] }] },
];

export const CATALOG = ['Panca piana', 'Panca inclinata', 'Croci ai cavi', 'Military press', 'Alzate laterali', 'Lat machine presa larga', 'Trazioni assistite', 'Rematore con manubrio', 'Pulley basso', 'Squat', 'Pressa', 'Stacco rumeno', 'Leg curl', 'Curl con manubri', 'Pushdown ai cavi'];

// Storico: data ISO, tipo, descrizione, numeri
export const HISTORY = [
  { id: 1, date: '2026-11-18', kind: 'pesi', day: 'Giorno A · Push', min: 58, vol: '9.420', record: true },
  { id: 2, date: '2026-11-16', kind: 'pesi', day: 'Giorno C · Legs', min: 64, vol: '12.180', record: false },
  { id: 3, date: '2026-11-14', kind: 'cardio', day: 'Bici', min: 45, km: '15,8' },
  { id: 4, date: '2026-11-12', kind: 'pesi', day: 'Giorno B · Pull', min: 55, vol: '8.760', record: true },
  { id: 5, date: '2026-11-10', kind: 'pesi', day: 'Giorno A · Push', min: 61, vol: '9.150', record: false },
  { id: 6, date: '2026-11-08', kind: 'cardio', day: 'Corsa', min: 35, km: '5,2' },
  { id: 7, date: '2026-11-05', kind: 'pesi', day: 'Giorno C · Legs', min: 66, vol: '11.940', record: false },
  { id: 8, date: '2026-10-29', kind: 'pesi', day: 'Giorno B · Pull', min: 52, vol: '8.540', record: false },
  { id: 9, date: '2026-10-27', kind: 'pesi', day: 'Giorno A · Push', min: 57, vol: '9.020', record: true },
  { id: 10, date: '2026-10-24', kind: 'cardio', day: 'Corsa', min: 30, km: '4,6' },
];
export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const dateLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

// Progressi: esercizi per gruppo (trend: up | flat | down)
export const GROUPS = [
  { name: 'Petto', ex: [{ id: 1, name: 'Panca piana', rm: 92, trend: 'up', fav: true }, { id: 2, name: 'Croci ai cavi', rm: 38, trend: 'flat', fav: false }] },
  { name: 'Dorsali', ex: [{ id: 3, name: 'Lat machine presa larga', rm: 83, trend: 'up', fav: true }, { id: 4, name: 'Rematore con manubrio', rm: 70, trend: 'down', fav: false }] },
  { name: 'Gambe', ex: [{ id: 5, name: 'Squat', rm: 120, trend: 'up', fav: false }, { id: 6, name: 'Stacco rumeno', rm: 130, trend: 'flat', fav: false }] },
  { name: 'Spalle', ex: [{ id: 7, name: 'Military press', rm: 55, trend: 'up', fav: false }] },
];
export const TREND = { up: ['↗', 'in miglioramento', 'success.main'], flat: ['→', 'fermo', 'text.secondary'], down: ['↘', 'in calo', 'warning.text'] };
export const CHART = {
  '1RM stimato': [78, 80, 80, 83, 85, 84, 88, 90, 92],
  'Max ripetizioni': [8, 8, 9, 8, 10, 9, 10, 10, 11],
  Volume: [2100, 2200, 2050, 2400, 2500, 2450, 2700, 2650, 2900],
};
export const SESSIONS = [['18 nov', '80 kg × 8, 8, 7, 6'], ['10 nov', '77,5 kg × 8, 8, 8, 7'], ['3 nov', '75 kg × 8, 8, 8, 8'], ['27 ott', '75 kg × 8, 8, 7, 7']];
export const MUSCLES = [['Petto', 12, 'ready'], ['Dorsali', 14, 'recovering'], ['Gambe', 16, 'fatigued'], ['Spalle', 8, 'ready'], ['Braccia', 12, 'recovering']];
export const WEIGHT_SERIES = [79.4, 79.2, 79.0, 78.9, 78.8, 78.9, 78.6, 78.5, 78.4];

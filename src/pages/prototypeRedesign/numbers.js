// PROTOTIPO (da buttare): numeri in formato italiano e dischi per lato
export const fmt = (n) => String(n).replace('.', ',');
export const toNum = (s) => Number(String(s).replace(',', '.'));

// Dischi per lato con bilanciere da 20 kg (dal più grande al più piccolo), es. 62,5 kg → «20 + 1,25»
export const platesText = (w) => {
  let rest = Math.max(0, (toNum(w) - 20) / 2);
  const parts = [];
  [20, 10, 5, 2.5, 1.25].forEach((p) => {
    while (rest + 1e-9 >= p) { parts.push(fmt(p)); rest -= p; }
  });
  return parts.length ? parts.join(' + ') : 'solo il bilanciere';
};

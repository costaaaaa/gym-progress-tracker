// PROTOTIPO (da buttare): opzioni del prototipo lette e scritte nei parametri dell'indirizzo
import { useSearchParams } from 'react-router-dom';

export const OPTIONS = {
  s: ['home', 'serie'],
  menu: ['ventaglio', 'pannello'],
  tondi: ['stretti', 'icone', 'compatti', 'grandi'],
  logo: ['centro', 'alto'],
  moduli: ['tutti', 'misure-cardio', 'misure', 'nessuno'],
  bozza: ['0', '1'],
  tecniche: ['scorri', 'capo'],
  strumenti: ['nessuno', 'tutti'],
  tema: ['chiaro', 'scuro'],
};
const DEFAULTS = { s: 'home', menu: 'ventaglio', tondi: 'stretti', logo: 'centro', moduli: 'tutti', bozza: '0', tecniche: 'scorri', strumenti: 'nessuno', tema: null };

export const useProto = () => {
  const [params, setParams] = useSearchParams();
  const values = {};
  Object.keys(OPTIONS).forEach((k) => {
    const v = params.get(k);
    values[k] = OPTIONS[k].includes(v) ? v : DEFAULTS[k];
  });
  const set = (k, v) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };
  return { values, set };
};

// Moduli accesi per ogni valore di `moduli` (nell'ordine in cui il primo spento viene proposto) e voci del menu centrale
export const ACTIVE_MODULES = { tutti: ['livello', 'gruppi', 'recupero', 'peso', 'cardio'], 'misure-cardio': ['peso', 'cardio'], misure: ['peso'], nessuno: [] };
export const MENU_VOCI = {
  tutti: { cardio: true, misura: true, coach: true },
  'misure-cardio': { cardio: true, misura: true, coach: false },
  misure: { cardio: false, misura: true, coach: false },
  nessuno: { cardio: false, misura: false, coach: false },
};

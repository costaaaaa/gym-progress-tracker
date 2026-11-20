// PROTOTIPO (da buttare): opzioni del prototipo lette e scritte nei parametri dell'indirizzo
import { useSearchParams } from 'react-router-dom';

export const OPTIONS = {
  s: ['home', 'prima', 'serie', 'recupero', 'riepilogo', 'schede', 'storico', 'progressi', 'account'],
  menu: ['ventaglio', 'pannello'],
  tondi: ['medi', 'compatti', 'stretti', 'icone', 'grandi'],
  logo: ['centro', 'alto'],
  moduli: ['tutti', 'misure-cardio', 'misure', 'nessuno'],
  bozza: ['0', '1'],
  tecniche: ['scorri', 'capo'],
  strumenti: ['nessuno', 'tutti'],
  home: ['saluto', 'colore', 'oggi', 'righe'],
  vista: ['elenco', 'calendario'],
  tab: ['esercizi', 'volume', 'corpo'],
  account: ['elenco', 'pagina'],
  tema: ['chiaro', 'scuro'],
};
const DEFAULTS = { s: 'home', home: 'saluto', menu: 'ventaglio', tondi: 'medi', logo: 'centro', moduli: 'tutti', bozza: '0', tecniche: 'scorri', strumenti: 'nessuno', vista: 'elenco', tab: 'esercizi', account: 'elenco', tema: null };

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
  // Più parametri insieme; un valore null toglie il parametro
  const setMany = (obj) => {
    const p = new URLSearchParams(params);
    Object.entries(obj).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    setParams(p, { replace: true });
  };
  // Parametri di dettaglio (scheda, allenamento, esercizio, pagina, giorno): nell'indirizzo ma non nel pannello
  const detail = (k) => params.get(k);
  return { values, set, setMany, detail };
};

// Moduli accesi per ogni valore di `moduli` (nell'ordine in cui il primo spento viene proposto) e voci del menu centrale
export const ACTIVE_MODULES = { tutti: ['livello', 'gruppi', 'recupero', 'peso', 'cardio'], 'misure-cardio': ['peso', 'cardio'], misure: ['peso'], nessuno: [] };
export const MENU_VOCI = {
  tutti: { cardio: true, misura: true, coach: true },
  'misure-cardio': { cardio: true, misura: true, coach: false },
  misure: { cardio: false, misura: true, coach: false },
  nessuno: { cardio: false, misura: false, coach: false },
};

// Quali moduli sono accesi per ogni valore di `moduli`
export const FLAGS = {
  tutti: { misure: true, cardio: true, recupero: true, livelli: true, coach: true },
  'misure-cardio': { misure: true, cardio: true, recupero: false, livelli: false, coach: false },
  misure: { misure: true, cardio: false, recupero: false, livelli: false, coach: false },
  nessuno: { misure: false, cardio: false, recupero: false, livelli: false, coach: false },
};

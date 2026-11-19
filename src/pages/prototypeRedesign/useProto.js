// PROTOTIPO (da buttare): opzioni del prototipo lette e scritte nei parametri dell'indirizzo
import { useSearchParams } from 'react-router-dom';

export const OPTIONS = {
  s: ['home', 'serie'],
  logo: ['centro', 'alto'],
  moduli: ['tutti', 'nessuno'],
  bozza: ['0', '1'],
  tecniche: ['scorri', 'capo'],
  strumenti: ['nessuno', 'tutti'],
  tema: ['chiaro', 'scuro'],
};
const DEFAULTS = { s: 'home', logo: 'centro', moduli: 'tutti', bozza: '0', tecniche: 'scorri', strumenti: 'nessuno', tema: null };

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

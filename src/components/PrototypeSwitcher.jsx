// PROTOTIPO (da buttare). Domanda: quale forma dare a campi e bottoni delle schermate di accesso?
// Assunzione dichiarata: le tre varianti differiscono SOLO nei raggi (card 16 invariata), niente varianti
// strutturali: la domanda è proprio sui raggi. ?variant=A|B|C sulle route /login e /register (default A).
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const VARIANTS = [
  { key: 'A', name: 'Oggi', field: null, button: null },
  { key: 'B', name: 'Pillola', field: 10, button: 999 },
  { key: 'C', name: 'Scalino', field: 10, button: 10 },
];

export const useVariant = () => {
  const [params] = useSearchParams();
  const key = import.meta.env.DEV ? params.get('variant') : null;
  return VARIANTS.find((v) => v.key === key) ?? VARIANTS[0];
};

// Sovrascrive solo i raggi di campo e bottone; il Paper della card resta a 16
export const ShapeVariant = ({ children }) => {
  const variant = useVariant();
  if (variant.field == null) return children;
  const theme = (outer) => createTheme(outer, {
    components: {
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: variant.field } } },
      MuiButton: { styleOverrides: { root: { borderRadius: variant.button } } },
    },
  });
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

const PrototypeSwitcher = () => {
  const [params, setParams] = useSearchParams();
  const current = useVariant();
  const index = VARIANTS.indexOf(current);

  const go = (delta) => {
    const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
    const p = new URLSearchParams(params);
    p.set('variant', next.key);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.matches('input, textarea, [contenteditable]') || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  const btn = { background: 'none', border: 0, color: '#fff', fontSize: 20, cursor: 'pointer', padding: '2px 10px' };
  return (
    <div
      data-prototype-switcher
      style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999,
        background: '#111', color: '#fff', font: '600 14px system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,.35)', whiteSpace: 'nowrap',
      }}
    >
      <button type="button" style={btn} onClick={() => go(-1)} aria-label="Variante precedente">←</button>
      <span>{current.key} ({current.name})</span>
      <button type="button" style={btn} onClick={() => go(1)} aria-label="Variante successiva">→</button>
    </div>
  );
};

export default PrototypeSwitcher;

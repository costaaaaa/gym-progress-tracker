// PROTOTIPO volume (branch usa e getta): barra in basso per passare da una variante all'altra.
// Compare solo nelle build con VITE_PROTOTYPE=1, mai in produzione.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useVariant = (keys) => {
  const [params] = useSearchParams();
  const v = params.get('variant');
  return keys.includes(v) ? v : keys[0];
};

const PrototypeSwitcher = ({ variants, names = {} }) => {
  const [params, setParams] = useSearchParams();
  const current = variants.includes(params.get('variant')) ? params.get('variant') : variants[0];
  const go = (step) => {
    const next = variants[(variants.indexOf(current) + step + variants.length) % variants.length];
    const p = new URLSearchParams(params);
    p.set('variant', next);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (import.meta.env.VITE_PROTOTYPE !== '1') return null;
  const btn = { background: 'none', border: 0, color: '#fff', font: 'inherit', fontSize: 18, padding: '4px 10px', cursor: 'pointer' };
  return (
    <div data-prototype-switcher style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: 4, background: '#7c3aed', color: '#fff', borderRadius: 999, padding: '4px 8px', font: '600 14px system-ui', boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
      <button type="button" style={btn} onClick={() => go(-1)} aria-label="Variante precedente">←</button>
      <span>{current}{names[current] ? ` (${names[current]})` : ''}</span>
      <button type="button" style={btn} onClick={() => go(1)} aria-label="Variante successiva">→</button>
    </div>
  );
};

export default PrototypeSwitcher;

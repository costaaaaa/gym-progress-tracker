// PROTOTIPO USA E GETTA: barra fissa in basso per cambiare variante (?variant=S2-T3).
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const PROTOTYPE_ON = import.meta.env.DEV || import.meta.env.VITE_PROTOTYPE === '1';

export const SELECTORS = {
  S1: 'Toggle sulla riga di "Nuova Misurazione"',
  S2: 'Toggle su riga propria',
  S3: 'Chip a pillola',
};
export const TABLES = {
  T1: 'Blocchi da 20',
  T2: 'Paginatore semplice',
  T3: 'TablePagination MUI',
};
export const COMBOS = Object.keys(SELECTORS).flatMap((s) => Object.keys(TABLES).map((t) => `${s}-${t}`));

export const parseVariant = (raw) => (COMBOS.includes(raw) ? raw : 'S1-T1');

const pill = (active) => ({
  px: 1, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700,
  color: active ? '#1a1816' : '#fff', bgcolor: active ? '#fff' : 'transparent',
  border: '1px solid rgba(255,255,255,.35)',
});

const PrototypeSwitcher = ({ current, children }) => {
  const [params, setParams] = useSearchParams();
  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
  };
  const go = (delta) => set({ variant: COMBOS[(COMBOS.indexOf(current) + delta + COMBOS.length) % COMBOS.length] });

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

  if (!PROTOTYPE_ON || params.get('bar') === '0') return null;
  const [s, t] = current.split('-');

  return (
    <Box
      sx={{
        position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
        width: 'max-content', maxWidth: 'calc(100vw - 16px)',
        bgcolor: '#1a1816', color: '#fff', borderRadius: 4, px: 1, py: 0.75,
        boxShadow: '0 6px 24px rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.15)',
        display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton size="small" onClick={() => go(-1)} sx={{ color: '#fff' }} aria-label="Variante precedente">
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ fontSize: 12.5, textAlign: 'center', lineHeight: 1.25 }}>
          <strong>{current}</strong>
          <br />
          {SELECTORS[s]} + {TABLES[t]}
        </Typography>
        <IconButton size="small" onClick={() => go(1)} sx={{ color: '#fff' }} aria-label="Variante successiva">
          <ChevronRightIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Object.keys(SELECTORS).map((k) => (
          <ButtonBase key={k} sx={pill(k === s)} onClick={() => set({ variant: `${k}-${t}` })}>{k}</ButtonBase>
        ))}
        <Box sx={{ width: 6 }} />
        {Object.keys(TABLES).map((k) => (
          <ButtonBase key={k} sx={pill(k === t)} onClick={() => set({ variant: `${s}-${k}` })}>{k}</ButtonBase>
        ))}
      </Box>
      {children}
    </Box>
  );
};

export default PrototypeSwitcher;

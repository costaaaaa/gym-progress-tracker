// PROTOTIPO (da buttare): recupero tra le serie, timer circolare che scende davvero
import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { platesText } from './numbers';
import { radius } from '../../theme/radius';
import { TABULAR, TITLE_FONT_FAMILY } from '../../utils/fonts';

const START = 90;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const RecuperoScreen = ({ wk, tools, onDone }) => {
  const [left, setLeft] = useState(START);
  const [total, setTotal] = useState(START);

  useEffect(() => {
    if (left <= 0) { onDone(); return undefined; }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onDone]);

  const next = wk.sets.findIndex((s) => s.w == null);
  const work = wk.sets.filter((s) => s.label !== 'R').length;
  const adjust = (d) => { setLeft((l) => Math.max(1, l + d)); setTotal((t) => Math.max(15, t + d)); };
  const R = 88;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, left / total));
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'background.default', px: 2, pt: 3, pb: 2 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'text.secondary' }}>Recupero</Typography>
      <Box sx={{ position: 'relative', width: 220, height: 220, mt: 2 }}>
        <Box component="svg" viewBox="0 0 200 200" aria-hidden="true" sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="100" cy="100" r={R} fill="none" strokeWidth="10" stroke="currentColor" style={{ opacity: 0.15 }} />
          <Box component="circle" cx="100" cy="100" r={R} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} sx={{ stroke: (t) => t.palette.primary.text }} />
        </Box>
        <Typography role="timer" aria-label={`Recupero: ${clock(left)}`} sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: '3.2rem', ...TABULAR }}>{clock(left)}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button variant="outlined" color="inherit" onClick={() => adjust(-15)} sx={{ minHeight: 48, minWidth: 100, borderRadius: radius.lg, fontWeight: 700 }}>−15 s</Button>
        <Button variant="outlined" color="inherit" onClick={() => adjust(15)} sx={{ minHeight: 48, minWidth: 100, borderRadius: radius.lg, fontWeight: 700 }}>+15 s</Button>
      </Box>
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="body2">Lat machine presa larga</Typography>
        {next === -1 ? (
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Esercizio completato</Typography>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', ...TABULAR }}>Prossima: serie {wk.sets[next].label} di {work} · {wk.weight} kg × {wk.reps}</Typography>
            {tools.dischi && <Typography color="text.secondary" sx={TABULAR}>Per lato: {platesText(wk.weight)} kg</Typography>}
          </>
        )}
      </Box>
      <Box sx={{ flex: 1 }} />
      <Button variant="outlined" color="inherit" fullWidth size="large" onClick={onDone} sx={{ py: 1.6, fontWeight: 700, borderRadius: radius.xl }}>Salta recupero</Button>
    </Box>
  );
};

export default RecuperoScreen;

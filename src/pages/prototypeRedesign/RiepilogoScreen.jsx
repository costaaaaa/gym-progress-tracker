// PROTOTIPO (da buttare): riepilogo dell'allenamento, serie toccabili per correggere
import { useState } from 'react';
import { Box, Button, ButtonBase, TextField, Typography } from '@mui/material';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import Sheet from './Sheet';
import SetsSheet from './SetsSheet';
import { cardSx, labelSx, titleSx } from './styles';
import { fmt } from './numbers';
import { radius } from '../../theme/radius';
import { TABULAR } from '../../utils/fonts';

const OTHERS = [
  { name: 'Trazioni assistite', sets: [{ label: '1', w: 20, r: 8 }, { label: '2', w: 20, r: 8 }, { label: '3', w: 15, r: 7 }] },
];

const RiepilogoScreen = ({ wk, flags, onDone }) => {
  const lat = wk.sets.filter((s) => s.label !== 'R');
  const [others, setOthers] = useState(OTHERS);
  const [open, setOpen] = useState(null); // { ex: indice, idx: serie }
  const [share, setShare] = useState(false);
  const exercises = [...others.map((e) => ({ ...e, live: false })), { name: 'Lat machine presa larga', sets: lat, live: true }];
  const update = (ei, newSets) => {
    if (exercises[ei].live) {
      wk.setSets((all) => all.map((s) => newSets.find((n) => n.label === s.label && s.label !== 'R') ?? s));
    } else {
      setOthers((o) => o.map((e, i) => (i === ei ? { ...e, sets: newSets } : e)));
    }
  };
  const done = exercises.reduce((n, e) => n + e.sets.filter((s) => s.w != null).length, 0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography component="h1" sx={{ ...titleSx, fontSize: '1.5rem', fontWeight: 700 }}>Allenamento completato</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {[['Durata', '58 min'], ['Volume', '9.240 kg'], ['Serie', String(done + 12)]].map(([l, v]) => (
            <Box key={l} sx={{ ...cardSx, p: 1.5, textAlign: 'center' }}>
              <Typography sx={{ ...TABULAR, fontWeight: 700, fontSize: '1.1rem' }}>{v}</Typography>
              <Typography variant="caption" color="text.secondary">{l}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={cardSx}>
          <Typography sx={labelSx}>Record di oggi</Typography>
          {[['Lat machine presa larga', '1RM stimato 83 kg'], ['Panca piana', '8 ripetizioni a 80 kg']].map(([n, r]) => (
            <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <EmojiEventsOutlinedIcon sx={{ color: 'warning.text' }} />
              <Typography sx={{ fontWeight: 600 }}>{n}</Typography>
              <Typography color="text.secondary" variant="body2">· {r}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={cardSx}>
          <Typography sx={labelSx}>Serie per esercizio</Typography>
          {exercises.map((e, ei) => (
            <Box key={e.name} sx={{ mt: 1.25 }}>
              <Typography sx={{ fontWeight: 600 }}>{e.name}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                {e.sets.map((s, si) => (s.w == null ? null : (
                  <ButtonBase key={si} onClick={() => setOpen({ ex: ei, idx: si })} aria-label={`${e.name}, serie ${s.label}: ${fmt(s.w)} kg per ${s.r}`} sx={{ minHeight: 44, px: 1.25, borderRadius: radius.md, bgcolor: 'background.subtle', border: '1px solid', borderColor: 'divider', ...TABULAR, fontSize: 14 }}>
                    {fmt(s.w)} × {s.r}
                  </ButtonBase>
                )))}
              </Box>
            </Box>
          ))}
        </Box>
        {flags.livelli && (
          <Box sx={cardSx}>
            <Typography sx={labelSx}>Streak, livello e traguardi</Typography>
            <Typography sx={{ mt: 0.75 }}>Streak di 4 settimane · Livello 12 (+80 punti)</Typography>
            <Typography color="text.secondary" variant="body2">Nuovo traguardo: 50 allenamenti</Typography>
          </Box>
        )}
        <TextField multiline minRows={2} fullWidth placeholder="Nota sull'allenamento" slotProps={{ htmlInput: { 'aria-label': 'Nota sull\'allenamento' } }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 1 }}>
          <Button variant="outlined" color="inherit" onClick={() => setShare(true)} sx={{ minHeight: 48, borderRadius: radius.lg, fontWeight: 600 }}>Condividi</Button>
          {flags.coach && <Button variant="outlined" color="inherit" sx={{ minHeight: 48, borderRadius: radius.lg, fontWeight: 600 }}>Chiedi al Coach</Button>}
          <Button variant="contained" onClick={onDone} sx={{ minHeight: 52, borderRadius: radius.lg, fontWeight: 700, boxShadow: 'none' }}>Fine</Button>
        </Box>
      </Box>
      {open && (
        <SetsSheet title={exercises[open.ex].name} sets={exercises[open.ex].sets} startIdx={open.idx} onChange={(ns) => update(open.ex, ns)} onClose={() => setOpen(null)} />
      )}
      <Sheet open={share} onClose={() => setShare(false)} title="Condividi">
        <Typography color="text.secondary">La card di condivisione arriva nel prossimo giro.</Typography>
      </Sheet>
    </Box>
  );
};

export default RiepilogoScreen;

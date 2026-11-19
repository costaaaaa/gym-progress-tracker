// PROTOTIPO (da buttare): pannello «Serie fatte», ogni serie si tocca per correggere peso e ripetizioni
import { useState } from 'react';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import Sheet from './Sheet';
import Stepper from './Stepper';
import { fmt, toNum } from './numbers';
import { radius } from '../../theme/radius';
import { TABULAR } from '../../utils/fonts';
import { BELOW_360 } from '../../theme/narrowScreens';

// Va montato solo quando è aperto: lo stato di modifica parte da `startIdx`
const SetsSheet = ({ title = 'Serie fatte', sets, onChange, onClose, startIdx = null }) => {
  const [editIdx, setEditIdx] = useState(startIdx);
  const [edit, setEdit] = useState(startIdx != null && sets[startIdx] ? { w: fmt(sets[startIdx].w), r: fmt(sets[startIdx].r) } : { w: '', r: '' });
  const startEdit = (i) => { setEditIdx(i); setEdit({ w: fmt(sets[i].w), r: fmt(sets[i].r) }); };
  const save = () => {
    onChange(sets.map((s, i) => (i === editIdx ? { ...s, w: toNum(edit.w), r: toNum(edit.r) } : s)));
    setEditIdx(null);
  };
  return (
    <Sheet open onClose={onClose} title={title}>
      {sets.map((s, i) => (s.w == null ? null : (
        <Box key={i} sx={{ mb: 0.5 }}>
          <ButtonBase onClick={() => startEdit(i)} sx={{ width: '100%', justifyContent: 'space-between', minHeight: 48, px: 1.5, borderRadius: radius.lg, bgcolor: 'background.subtle' }}>
            <Typography sx={{ fontWeight: 600 }}>{s.label === 'R' ? 'Riscaldamento' : `Serie ${s.label}`}</Typography>
            <Typography sx={TABULAR}>{fmt(s.w)} kg × {s.r}</Typography>
          </ButtonBase>
          {editIdx === i && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
              <Box sx={{ display: 'flex', gap: 1.5, [BELOW_360]: { flexDirection: 'column', gap: 1 } }}>
                <Stepper label="Peso (kg)" value={edit.w} onChange={(w) => setEdit((e) => ({ ...e, w }))} step={2.5} decimal />
                <Stepper label="Ripetizioni" value={edit.r} onChange={(r) => setEdit((e) => ({ ...e, r }))} step={1} />
              </Box>
              <Button variant="contained" onClick={save} sx={{ minHeight: 44, alignSelf: 'flex-end' }}>Salva</Button>
            </Box>
          )}
        </Box>
      )))}
      <Typography variant="caption" color="text.secondary">Tocca una serie per correggere peso e ripetizioni.</Typography>
    </Sheet>
  );
};

export default SetsSheet;

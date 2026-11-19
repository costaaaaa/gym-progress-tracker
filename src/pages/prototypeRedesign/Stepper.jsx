// PROTOTIPO (da buttare): campo numerico grande con − e +
import { Box, IconButton, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { TABULAR } from '../../utils/fonts';
import { fmt, toNum } from './numbers';
import { iconBtnSx } from './styles';

const Stepper = ({ label, value, onChange, step, decimal }) => {
  const bump = (d) => {
    const n = toNum(value);
    const next = Math.max(0, Math.round(((Number.isFinite(n) ? n : 0) + d * step) * 100) / 100);
    onChange(fmt(next));
  };
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="label" htmlFor={`f-${label}`}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton aria-label={`${label} meno`} onClick={() => bump(-1)} sx={iconBtnSx}><RemoveIcon /></IconButton>
        <TextField
          id={`f-${label}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ htmlInput: { inputMode: decimal ? 'decimal' : 'numeric', style: { textAlign: 'center', fontSize: '1.7rem', fontWeight: 700, padding: '8px 0', ...TABULAR } } }}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <IconButton aria-label={`${label} più`} onClick={() => bump(1)} sx={iconBtnSx}><AddIcon /></IconButton>
      </Box>
    </Box>
  );
};

export default Stepper;

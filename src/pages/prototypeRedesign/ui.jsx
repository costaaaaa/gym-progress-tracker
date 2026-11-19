// PROTOTIPO (da buttare): piccoli componenti condivisi (selettore a segmenti, riga, titolo, indietro, interruttore)
import { Box, ButtonBase, IconButton, Switch, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

export const Seg = ({ options, value, onChange, label }) => (
  <Box role="group" aria-label={label} sx={{ display: 'flex', bgcolor: 'background.subtle', border: '1px solid', borderColor: 'divider', borderRadius: radius.lg, p: '3px', gap: '3px' }}>
    {options.map((o) => {
      const on = o.value === value;
      return (
        <ButtonBase
          key={o.value}
          aria-pressed={on}
          onClick={() => onChange(o.value)}
          sx={{ flex: 1, minHeight: 38, borderRadius: radius.md, fontSize: 14, fontWeight: 600, px: 1, bgcolor: on ? 'text.primary' : 'transparent', color: on ? 'background.default' : 'text.primary' }}
        >
          {o.label}
        </ButtonBase>
      );
    })}
  </Box>
);

export const Chip = ({ on, onClick, children }) => (
  <ButtonBase
    aria-pressed={on}
    onClick={onClick}
    sx={{ flex: '0 0 auto', minHeight: 40, px: 1.75, borderRadius: radius.pill, fontSize: 14, fontWeight: 600, border: '1px solid', borderColor: on ? 'text.primary' : 'divider', bgcolor: on ? 'text.primary' : 'transparent', color: on ? 'background.default' : 'text.primary' }}
  >
    {children}
  </ButtonBase>
);

export const NavRow = ({ title, subtitle, onClick, right }) => (
  <ButtonBase onClick={onClick} sx={{ width: '100%', display: 'flex', justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, minHeight: 56, px: 2, py: 1, borderRadius: 0 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Box>
    {right}
    <ChevronRightIcon sx={{ color: 'text.secondary', flex: '0 0 auto' }} />
  </ButtonBase>
);

export const PageTitle = ({ children, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 44 }}>
    <Typography component="h1" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: '1.4rem' }}>{children}</Typography>
    {action}
  </Box>
);

export const Back = ({ onClick, label = 'Indietro' }) => (
  <IconButton aria-label={label} onClick={onClick} sx={{ width: 44, height: 44, ml: -1 }}><ArrowBackIcon /></IconButton>
);

export const Toggle = ({ label, hint, checked, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 52 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
      {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
    </Box>
    <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { 'aria-label': label } }} />
  </Box>
);

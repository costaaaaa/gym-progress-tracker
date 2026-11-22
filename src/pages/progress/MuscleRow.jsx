import { Box, Typography } from '@mui/material';
import { muscleLabel } from '../../i18n/labels';
import { STATUS_COLOR } from '../../utils/recoveryStatus';
import { radius } from '../../theme/radius';
import Delta from './Delta';

// Barra proporzionale al muscolo più allenato della settimana; vuota (0) se il muscolo non ha serie.
const Bar = ({ value, max, label }) => (
  <Box
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value}
    sx={{ flex: 1, minWidth: 0, height: 8, borderRadius: radius.pill, bgcolor: 'divider', overflow: 'hidden' }}
  >
    <Box sx={{ height: '100%', width: `${max ? (value / max) * 100 : 0}%`, bgcolor: 'primary.main', borderRadius: radius.pill }} />
  </Box>
);

const Dot = ({ status }) => (
  <Box sx={{ width: 10, height: 10, borderRadius: radius.pill, flexShrink: 0, bgcolor: status ? STATUS_COLOR[status] : 'divider' }} />
);

// Una riga per muscolo del piano completo: pallino e nome, le serie della settimana (`sets`: { week, previous, max }), la
// variazione e la barra, e a destra lo stato di recupero già scritto in `recoveryLabel`. Le righe del piano Gratis sono
// BasicMuscleRow.
const MuscleRow = ({ muscle, status, recoveryLabel, sets }) => {
  const ready = status === 'PRONTO';
  return (
    <Box component="li">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Dot status={status} />
        <Typography sx={{ fontSize: 16, flex: 1, minWidth: 0, overflowWrap: 'anywhere', color: sets.week > 0 ? 'text.primary' : 'text.secondary' }}>
          {muscleLabel(muscle)}
        </Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{sets.week}</Typography>
        <Box sx={{ minWidth: 56, textAlign: 'right' }}><Delta value={sets.week - sets.previous} /></Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75, pl: 2.25 }}>
        <Bar value={sets.week} max={sets.max} label={muscleLabel(muscle)} />
        <Typography sx={{ fontSize: 16, textAlign: 'right', width: { xs: 128, sm: 160 }, fontWeight: ready ? 600 : 400, color: ready ? 'recovery.ready' : 'text.secondary' }}>
          {recoveryLabel}
        </Typography>
      </Box>
    </Box>
  );
};

export default MuscleRow;

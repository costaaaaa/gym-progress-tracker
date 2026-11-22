import { Box, Typography } from '@mui/material';
import { muscleLabel } from '../i18n/labels';
import { STATUS_COLOR } from '../utils/recoveryStatus';
import { radius } from '../theme/radius';

// Riga di un muscolo per il piano Gratis (detail "basic"): senza barra, percentuale né giorni mancanti.
// Con `label` (card «Per muscolo» della tab Volume) c'è anche il pallino di stato e lo stato scritto a destra; senza (card in Home)
// solo il nome, perché è il titolo del blocco a dire se è pronto o in recupero.
const BasicMuscleRow = ({ muscle, status, label }) => (
  <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {label && <Box sx={{ width: 10, height: 10, borderRadius: radius.pill, flexShrink: 0, bgcolor: status ? STATUS_COLOR[status] : 'divider' }} />}
    <Typography noWrap sx={{ fontSize: 16, flex: 1, color: 'text.primary' }}>{muscleLabel(muscle)}</Typography>
    {label && (
      <Typography sx={{ fontSize: 16, fontWeight: status === 'PRONTO' ? 600 : 400, color: status === 'PRONTO' ? 'recovery.ready' : 'text.secondary' }}>
        {label}
      </Typography>
    )}
  </Box>
);

export default BasicMuscleRow;

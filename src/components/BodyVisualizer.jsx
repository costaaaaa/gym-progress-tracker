import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../i18n/labels';

// Gruppi muscolari tracciati (stesse chiavi usate da
// dashboardStats.recovery restituito da api/workout_stats/dashboard.php).
const MUSCLE_GROUPS = [
  'petto',
  'schiena',
  'spalle',
  'bicipiti',
  'tricipiti',
  'addome',
  'quadricipiti',
  'femorali',
  'glutei',
  'polpacci',
];

// Stato grezzo dal backend ("PRONTO" / "IN RECUPERO" / "AFFATICATO") → chiave dell'etichetta + colore.
const STATUS_META = {
  PRONTO: { label: 'recovery.ready', color: 'success.main' },
  'IN RECUPERO': { label: 'recovery.recovering', color: 'warning.main' },
  AFFATICATO: { label: 'recovery.fatigued', color: 'error.main' },
};

// Righe di una colonna della lista: nome a sinistra, stato a destra.
const MuscleRow = ({ group, recoveryData }) => {
  const { t } = useTranslation();
  const status = recoveryData?.[group]?.status;
  const meta = STATUS_META[status];
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{muscleLabel(group)}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: meta ? meta.color : 'text.disabled' }}>
        {meta ? t(meta.label) : t('recovery.no_data')}
      </Typography>
    </Box>
  );
};

const BodyVisualizer = ({ recoveryData }) => {
  const { t } = useTranslation();
  const half = Math.ceil(MUSCLE_GROUPS.length / 2);
  const leftColumn = MUSCLE_GROUPS.slice(0, half);
  const rightColumn = MUSCLE_GROUPS.slice(half);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2 }}>
        {t('recovery.title')}
      </Typography>

      {/* Due liste separate da un divisore verticale, per evitare l'ambiguità della griglia
          implicita (dove non era chiaro quali righe appartenessero a quale colonna). */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {leftColumn.map((group) => (
            <MuscleRow key={group} group={group} recoveryData={recoveryData} />
          ))}
        </Box>
        <Box sx={{ width: '1px', bgcolor: 'divider', flexShrink: 0 }} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {rightColumn.map((group) => (
            <MuscleRow key={group} group={group} recoveryData={recoveryData} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default BodyVisualizer;

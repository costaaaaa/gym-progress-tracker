import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../i18n/labels';
import { readyInDays } from '../utils/recoveryDay';

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
  PRONTO: { label: 'recovery.ready', color: 'recovery.ready' },
  'IN RECUPERO': { label: 'recovery.recovering', color: 'recovery.recovering' },
  AFFATICATO: { label: 'recovery.fatigued', color: 'recovery.fatigued' },
};

// "pronto oggi" / "pronto domani" / "pronto tra N giorni": mai l'ora, il calcolo è una stima.
const readyLabel = (t, days) => {
  if (days === 0) return t('recovery.ready_today');
  if (days === 1) return t('recovery.ready_tomorrow');
  return t('recovery.ready_in_days', { count: days });
};

// Una riga della lista: nome e stato, barra di avanzamento del recupero, giorno indicativo.
const MuscleRow = ({ group, recoveryData }) => {
  const { t } = useTranslation();
  const info = recoveryData?.[group];
  const meta = STATUS_META[info?.status];
  const days = info?.status === 'PRONTO' ? null : readyInDays(info?.ready_at);
  const percent = typeof info?.percent === 'number' ? Math.max(0, Math.min(100, info.percent)) : null;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{muscleLabel(group)}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: meta ? meta.color : 'text.disabled' }}>
          {meta ? t(meta.label) : t('recovery.no_data')}
        </Typography>
      </Box>
      {meta && percent !== null && (
        <Box sx={{ height: 5, borderRadius: '3px', bgcolor: 'divider', overflow: 'hidden', mt: 0.75 }}>
          <Box data-recovery-bar sx={{ height: '100%', width: `${percent}%`, bgcolor: meta.color, borderRadius: '3px' }} />
        </Box>
      )}
      {days !== null && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{readyLabel(t, days)}</Typography>
      )}
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
          implicita (dove non era chiaro quali righe appartenessero a quale colonna).
          Sui telefoni le colonne sarebbero troppo strette ("Quadricipiti" + "In recupero"
          andava a capo): lì diventano una lista unica. */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {leftColumn.map((group) => (
            <MuscleRow key={group} group={group} recoveryData={recoveryData} />
          ))}
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '1px', bgcolor: 'divider', flexShrink: 0 }} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {rightColumn.map((group) => (
            <MuscleRow key={group} group={group} recoveryData={recoveryData} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default BodyVisualizer;

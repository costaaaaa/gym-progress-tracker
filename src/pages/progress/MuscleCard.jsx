import { Box, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, isNeverTrained } from '../../utils/recoveryGroups';
import { readyInDays } from '../../utils/recoveryDay';
import { readyLabel } from '../../utils/recoveryStatus';
import LockedRow from '../../components/LockedRow';
import MuscleRow from './MuscleRow';

const TITLE_ID = 'progress-muscles-title';

// Testo di recupero di una riga: "Pronto" o il conto alla rovescia già usato in BodyVisualizer; "nessun dato" se il server non
// ha (ancora) un recupero per questo muscolo.
const recoveryText = (t, status, days) => {
  if (status === 'PRONTO') return t('recovery.ready');
  if (!status) return t('progress.volume.no_data');
  return readyLabel(t, days);
};

// Etichetta di stato del piano Gratis: Puoi allenare / In recupero / nessun dato.
const basicText = (t, status) => (status === 'PRONTO' ? t('recovery.can_train') : status ? t('recovery.basic_resting') : t('progress.volume.no_data'));

// La card «Per muscolo» (modulo Recupero): una riga per muscolo, nell'ordine del corpo, con le serie della settimana, la
// variazione e lo stato di recupero. Nel piano Gratis (`stats.basic`) in cima le due righe con lucchetto e per ogni muscolo
// solo «Puoi allenare» / «In recupero». `stats`: il risultato di useWeeklyStats.
const MuscleCard = ({ stats }) => {
  const { t } = useTranslation();
  const { sets, recovery, basic } = stats;
  const max = Math.max(1, ...MUSCLE_GROUPS.map((m) => sets.week?.[m] || 0));
  return (
    <Card component="section" aria-labelledby={TITLE_ID} sx={{ p: { xs: 2, sm: '20px 22px' } }}>
      <Typography id={TITLE_ID} component="h2" variant="cardTitle" sx={{ mb: 1.5 }}>{t('progress.volume.by_muscle')}</Typography>
      {basic && (
        <>
          <LockedRow sx={{ mb: 1 }} compare={false}>{t('progress.volume.locked_sets')}</LockedRow>
          <LockedRow>{t('recovery.locked')}</LockedRow>
        </>
      )}
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MUSCLE_GROUPS.map((muscle) => {
          const entry = recovery[muscle];
          const status = isNeverTrained(entry) ? null : entry?.status || null;
          if (basic) return <MuscleRow key={muscle} muscle={muscle} status={status} recoveryLabel={basicText(t, status)} />;
          const days = entry?.ready_at ? readyInDays(entry.ready_at) : null;
          return (
            <MuscleRow
              key={muscle}
              muscle={muscle}
              status={status}
              recoveryLabel={recoveryText(t, status, days)}
              sets={{ week: sets.week?.[muscle] || 0, previous: sets.previous_to_date?.[muscle] || 0, max }}
            />
          );
        })}
      </Box>
    </Card>
  );
};

export default MuscleCard;

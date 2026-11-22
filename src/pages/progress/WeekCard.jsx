import { Box, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Delta from './Delta';
import { formatVolume } from '../formatVolume';

const TITLE_ID = 'progress-week-title';

// Un numero grande con la sua etichetta sotto. Il testo lungo (un volume a sei cifre a 320 px) va a capo dentro la colonna.
const Stat = ({ label, value }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="statNumber" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
    <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>{label}</Typography>
  </Box>
);

// La card «Questa settimana»: volume sollevato (nell'unità dell'utente) e serie, affiancati; sotto, il confronto delle serie
// con la settimana scorsa allo stesso punto (con il totale intero come riferimento) quando il server lo manda. Per il volume
// il server non manda nessun confronto, e il client non lo calcola. `stats`: il risultato di useWeeklyStats.
const WeekCard = ({ stats, weightUnit }) => {
  const { t } = useTranslation();
  return (
    <Card component="section" aria-labelledby={TITLE_ID} sx={{ p: { xs: 2, sm: '20px 22px' } }}>
      <Typography id={TITLE_ID} component="h2" variant="cardTitle" sx={{ mb: 1.5 }}>{t('progress.volume.week_title')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, auto))', justifyContent: 'start', columnGap: { xs: 3, sm: 6 } }}>
        <Stat label={t('progress.volume.volume')} value={formatVolume(stats.volumeKg, weightUnit)} />
        <Stat label={t('progress.volume.sets')} value={stats.setsTotal} />
      </Box>
      {!stats.basic && (
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 2 }}>
          {t('progress.volume.previous_at', { count: stats.previousToDate })} <Delta value={stats.setsTotal - stats.previousToDate} /> · {t('progress.volume.previous_total', { count: stats.previousTotal })}
        </Typography>
      )}
    </Card>
  );
};

export default WeekCard;

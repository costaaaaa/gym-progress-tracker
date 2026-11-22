import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useModule } from '../hooks/useModule';
import useWeeklyStats from './progress/useWeeklyStats';
import WeekCard from './progress/WeekCard';
import MuscleCard from './progress/MuscleCard';
import LoadError from './progress/LoadError';

// Tab «Volume» dei Progressi: la card «Questa settimana» (sempre) e, con il modulo Recupero attivo, la card «Per muscolo».
// La lettura dei dati è di useWeeklyStats.
const Volume = () => {
  const { t } = useTranslation();
  const { weightUnit } = useAuth();
  const recoveryOn = useModule('recovery');
  const { stats, loading, loadFailed, refresh } = useWeeklyStats();

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>;
  if (loadFailed) {
    return <LoadError message={t('progress.volume.load_error')} onRetry={refresh} />;
  }
  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <WeekCard stats={stats} weightUnit={weightUnit} />
      {recoveryOn && <MuscleCard stats={stats} />}
    </Box>
  );
};

export default Volume;

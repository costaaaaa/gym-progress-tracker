import { useEffect } from 'react';
import { Box, Card, CircularProgress, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useAuth } from '../../context/AuthContext';
import useExerciseProgress from './useExerciseProgress';
import { formatValue, groupLabel } from './exerciseText';
import ExerciseChart from './ExerciseChart';
import ExerciseHistory from './ExerciseHistory';
import LoadError from './LoadError';

const BACK_PATH = '/progressi';
const CHART_TITLE_ID = 'exercise-chart-title';

// Pagina di un esercizio (/progressi/esercizi/:id): nome e gruppo muscolare, riquadri (Attuale, Migliore, Sessioni), il
// grafico dell'andamento e la cronologia delle sessioni. Un esercizio che non c'è tra quelli allenati riporta all'elenco,
// ma solo a lettura finita e riuscita.
const ExercisePage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { weightUnit } = useAuth();
  const { analyzed, loading, loadFailed, refresh } = useExerciseProgress();
  const item = analyzed.find((a) => String(a.id) === id);
  // finché non c'è il nome (lettura in corso o fallita) il titolo è quello della pagina dei Progressi
  usePageMeta(item ? item.name : t('dashboard.title'), t('progress.exercise_meta'));

  useEffect(() => {
    if (!loading && !loadFailed && !item) navigate(BACK_PATH, { replace: true });
  }, [loading, loadFailed, item, navigate]);

  const back = (
    <IconButton component={RouterLink} to={BACK_PATH} aria-label={t('progress.back')} edge="start" sx={{ width: 44, height: 44, color: 'text.primary' }}>
      <ArrowBackIcon />
    </IconButton>
  );

  const body = () => {
    if (loadFailed) {
      return (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {back}
            <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0 }}>{t('dashboard.title')}</Typography>
          </Box>
          <LoadError message={t('progress.error.connection')} onRetry={refresh} />
        </>
      );
    }
    if (!item) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

    const tiles = [
      [t('progress.detail.current'), formatValue(t, item.mode, item.last.value, weightUnit)],
      [t('progress.detail.best'), formatValue(t, item.mode, item.best, weightUnit)],
      [t('progress.detail.sessions'), String(item.sessions.length)],
    ];
    return (
      <>
        {/* Con il sottotitolo la riga è più alta di 44 px: la freccia resta in cima, in asse con il blocco del titolo */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2.5 }}>
          {back}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="pageTitle" sx={{ overflowWrap: 'anywhere' }}>{item.name}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{groupLabel(t, item.muscle)}</Typography>
          </Box>
        </Box>

        {/* Sotto sm le colonne seguono il contenuto, con riempimento e spazi stretti: il valore sta su una riga a 320 px */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, auto)', sm: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1, sm: 1.5 }, mb: 2.5 }}>
          {tiles.map(([label, value]) => (
            <Card key={label} sx={{ p: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
              <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontSize: { xs: 16, sm: 20 }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</Typography>
            </Card>
          ))}
        </Box>

        <Card component="section" aria-labelledby={CHART_TITLE_ID} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2.5 }}>
          <Typography id={CHART_TITLE_ID} component="h2" variant="cardTitle" sx={{ mb: 1 }}>{t(`progress.kind.${item.mode}`)}</Typography>
          {item.skipped > 0 && (
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 1 }}>{t('progress.skipped_sessions', { count: item.skipped })}</Typography>
          )}
          <ExerciseChart item={item} weightUnit={weightUnit} />
        </Card>

        <ExerciseHistory item={item} weightUnit={weightUnit} />
      </>
    );
  };

  return <Box sx={{ pb: 3 }}>{body()}</Box>;
};

export default ExercisePage;

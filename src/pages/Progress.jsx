import { useState, useMemo, useDeferredValue } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { exerciseMatches } from '../utils/exerciseCatalog';
import { groupByMuscle, summarize } from '../utils/progressOverview';
import { useFavoriteExercises } from '../hooks/useFavoriteExercises';
import useExerciseProgress from './progress/useExerciseProgress';
import ProgressSummary from './progress/ProgressSummary';
import MuscleGroupCard from './progress/MuscleGroupCard';

// Tab «Esercizi» dei Progressi: il riepilogo, la ricerca, il filtro «Preferiti» e una card per gruppo muscolare; ogni riga
// porta alla pagina dell'esercizio (/progressi/esercizi/<id>). La lettura dei dati è di useExerciseProgress.
const Progress = ({ isEmbedded = false }) => {
  const { t } = useTranslation();
  const { weightUnit } = useAuth();
  const { analyzed, catalog, loading, loadFailed, refresh } = useExerciseProgress();
  const { favorites, toggleFavorite } = useFavoriteExercises();
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const summary = useMemo(() => summarize(analyzed), [analyzed]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  // Il chip c'è solo se almeno un esercizio dell'elenco è preferito; tolto l'ultimo, il filtro non resta acceso
  const hasFavorites = analyzed.some((a) => favoriteSet.has(a.id));
  const favoritesOn = onlyFavorites && hasFavorites;
  // ...e senza preferiti la scelta si azzera, altrimenti alla prossima stella il chip ricomparirebbe già acceso
  if (onlyFavorites && !hasFavorites && !loading) setOnlyFavorites(false);

  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const matching = deferredQuery.trim().length > 0
      ? analyzed.filter((a) => exerciseMatches({ ...catalog[a.id], name: a.name }, deferredQuery))
      : analyzed;
    return favoritesOn ? matching.filter((a) => favoriteSet.has(a.id)) : matching;
  }, [analyzed, catalog, deferredQuery, favoritesOn, favoriteSet]);
  const sections = useMemo(() => groupByMuscle(filtered), [filtered]);

  const renderContent = () => {
    if (loading) {
      return <Grid item xs={12}><Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box></Grid>;
    }
    if (loadFailed) {
      return (
        <Grid item xs={12}>
          <Alert severity="error" sx={{ fontSize: 16 }} action={<Button color="inherit" onClick={refresh} sx={{ minHeight: 44, fontSize: 16, fontWeight: 600 }}>{t('progress.retry')}</Button>}>
            {t('progress.error.connection')}
          </Alert>
        </Grid>
      );
    }
    if (analyzed.length === 0) {
      return (
        <Grid item xs={12}>
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('progress.error.no_history')}</Typography>
          </Card>
        </Grid>
      );
    }
    return (
      <>
        <Grid item xs={12}><ProgressSummary summary={summary} /></Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('progress.search')}
            inputProps={{ 'aria-label': t('progress.search') }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          {hasFavorites && (
            <Chip
              label={t('progress.favorites')}
              variant="outlined"
              aria-pressed={favoritesOn}
              onClick={() => setOnlyFavorites(!favoritesOn)}
              sx={{
                mt: 1.5, height: 44, minHeight: 44, fontSize: 16, color: 'text.primary',
                borderColor: favoritesOn ? 'text.primary' : 'text.secondary',
                ...(favoritesOn && { bgcolor: 'action.selected', fontWeight: 600 }),
              }}
            />
          )}
        </Grid>

        {filtered.length === 0 && (
          <Grid item xs={12}>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', textAlign: 'center', py: 3 }}>{t('progress.search_empty')}</Typography>
          </Grid>
        )}

        {sections.map((section) => (
          <Grid item xs={12} key={section.muscle}>
            <MuscleGroupCard section={section} weightUnit={weightUnit} favoriteSet={favoriteSet} onToggleFavorite={toggleFavorite} />
          </Grid>
        ))}
      </>
    );
  };

  return (
    <Box sx={{ py: isEmbedded ? 2 : 4 }}>
      <Grid container spacing={3}>
        {!isEmbedded && (
          <Grid item xs={12}>
            <Typography variant="pageTitle" gutterBottom>{t('progress.title')}</Typography>
            <Typography variant="body1" color="text.secondary" paragraph>{t('progress.intro')}</Typography>
          </Grid>
        )}
        {renderContent()}
      </Grid>
    </Box>
  );
};

export default Progress;

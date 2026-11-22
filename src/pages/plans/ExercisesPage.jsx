import { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, CircularProgress, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';
import { personalLabel } from '../../api/exercises';
import { rankExerciseMatches } from '../../utils/exerciseCatalog';
import { equipmentName, muscleLabel } from '../../i18n/labels';
import { NEUTRAL_OUTLINED } from '../../utils/buttonStyles';
import useAllExercises from './useAllExercises';

// Come in ExerciseDialog: se qui cambiasse, la pagina e il dialog raggrupperebbero gli esercizi in modo diverso
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

// Pagina «Tutti gli esercizi» (/schede/esercizi): si cerca e si sfoglia lo stesso elenco di ExerciseDialog (catalogo
// ed esercizi personali), in sola lettura. Ricerca e gruppo muscolare si sommano; gli esercizi si aggiungono alle
// schede e si creano altrove.

const ExercisesPage = () => {
  const { t, i18n } = useTranslation();
  usePageMeta(t('plans.exercises.title'), t('plans.meta.description'));
  const { status, records, message, retry } = useAllExercises();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(''); // '' = tutti; altrimenti uno dei `groups`

  // Gruppi presenti, in ordine alfabetico dell'etichetta nella lingua corrente. Come in ExerciseDialog, «petto» e
  // «Petto» sono lo stesso gruppo (confronto con la prima lettera maiuscola)
  const groups = useMemo(
    () => [...new Set(records.map((ex) => capitalize(ex.muscle_group)).filter(Boolean))]
      .sort((a, b) => muscleLabel(a).localeCompare(muscleLabel(b), i18n.language)),
    [records, i18n.language],
  );

  const shown = useMemo(() => {
    const inGroup = group ? records.filter((ex) => capitalize(ex.muscle_group) === group) : records;
    if (query.trim()) return rankExerciseMatches(inGroup, query);
    return [...inGroup].sort((a, b) => (a.name || '').localeCompare(b.name || '', i18n.language));
  }, [records, group, query, i18n.language]);

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton component={RouterLink} to="/schede" aria-label={t('nav.plans')} edge="start" sx={{ width: 44, height: 44, color: 'text.primary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{t('plans.exercises.title')}</Typography>
      </Box>

      {status === 'loading' && <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>}

      {status === 'error' && (
        <Alert
          severity="error"
          action={<Button onClick={retry} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, fontWeight: 600 }} variant="outlined">{t('plans.exercises.retry')}</Button>}
        >
          <div>{t('plans.exercises.load_error')}</div>
          {message && <div>{message}</div>}
        </Alert>
      )}

      {status === 'ready' && (
        <>
          <TextField
            fullWidth
            placeholder={t('plans.exercises.search')}
            inputProps={{ 'aria-label': t('plans.exercises.search') }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ mb: 2, '& input::placeholder': { color: 'text.secondary', opacity: 1 } }}
          />

          <Box role="group" aria-label={t('plans.exercises.group_filter')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {['', ...groups].map((key) => {
              const on = group === key;
              return (
                <Chip
                  key={key || 'all'}
                  label={key ? muscleLabel(key) : t('plans.exercises.all')}
                  variant="outlined"
                  aria-pressed={on}
                  onClick={() => setGroup(key)}
                  sx={{
                    height: 44, minHeight: 44, fontSize: 16, color: 'text.primary',
                    borderColor: on ? 'text.primary' : 'text.secondary',
                    ...(on && { bgcolor: 'action.selected', fontWeight: 600 }),
                  }}
                />
              );
            })}
          </Box>

          <Box role="status" aria-live="polite" sx={visuallyHidden}>{t('plans.exercises.count', { count: shown.length })}</Box>

          {shown.length === 0 ? (
            <Typography sx={{ fontSize: 16, color: 'text.secondary', py: 3 }}>{t('plans.exercises.none')}</Typography>
          ) : (
            <Card>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {shown.map((ex) => (
                  <Box
                    component="li"
                    key={ex.id}
                    sx={{ px: 2.5, py: 1.5, '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' } }}
                  >
                    <Typography data-testid="exercise-name" sx={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{ex.name}</Typography>
                    <Typography data-testid="exercise-detail" sx={{ fontSize: 16, color: 'text.secondary' }}>
                      {[muscleLabel(ex.muscle_group), equipmentName(ex.equipment), personalLabel(ex)].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default ExercisesPage;

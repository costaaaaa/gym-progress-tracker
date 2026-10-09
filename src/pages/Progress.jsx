import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Card,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { API_BASE_URL } from '../config';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../i18n/labels';
import { exerciseMatches } from '../utils/exerciseCatalog';
import {
  buildExerciseSeries,
  analyzeExercise,
  withCatalog,
  groupByMuscle,
  summarize,
  byRecency,
  RECENT_DAYS,
  MAX_PR_CHIPS,
} from '../utils/progressOverview';
import { useFavoriteExercises } from '../hooks/useFavoriteExercises';
import ExerciseProgressCard, { formatDaysAgo } from '../components/ExerciseProgressCard';
import ExerciseDetailDialog from '../components/ExerciseDetailDialog';

const OPEN_SECTIONS_DEFAULT = 2;

const SummaryStat = ({ label, value, color }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 28, lineHeight: 1, color }}>{value}</Typography>
    <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, mt: 0.5 }}>{label}</Typography>
  </Box>
);

const Progress = ({ isEmbedded = false }) => {
  const { t } = useTranslation();
  const [exerciseCatalog, setExerciseCatalog] = useState({});
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const { favorites, toggleFavorite } = useFavoriteExercises();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const [exRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}api/exercise/read_all.php`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}api/workout_history/read.php`, { credentials: 'include' }),
      ]);
      if (!exRes.ok) throw new Error('exercises');
      const exData = await exRes.json();
      const catalog = {};
      (exData.records || []).forEach((ex) => { catalog[String(ex.id)] = ex; });
      setExerciseCatalog(catalog);

      // 404 = nessun allenamento registrato, non un errore di connessione
      if (histRes.status === 404) {
        setRecords([]);
      } else if (!histRes.ok) {
        throw new Error('history');
      } else {
        const histData = await histRes.json();
        setRecords(Array.isArray(histData.records) ? histData.records : []);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei progressi:', error);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const analyzed = useMemo(() => {
    const now = Date.now();
    const items = Object.values(buildExerciseSeries(records)).map((serie) => analyzeExercise(serie, now));
    return withCatalog(items, exerciseCatalog);
  }, [records, exerciseCatalog]);

  const summary = useMemo(() => summarize(analyzed), [analyzed]);

  const deferredQuery = useDeferredValue(query);
  const searching = deferredQuery.trim().length > 0;
  const filtered = useMemo(() => {
    if (!searching) return analyzed;
    return analyzed.filter((a) => exerciseMatches({ ...exerciseCatalog[a.id], name: a.name }, deferredQuery));
  }, [analyzed, exerciseCatalog, searching, deferredQuery]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const favoriteItems = useMemo(
    () => filtered.filter((a) => favoriteSet.has(a.id)).sort(byRecency),
    [filtered, favoriteSet],
  );
  const sections = useMemo(
    () => groupByMuscle(filtered.filter((a) => !favoriteSet.has(a.id))),
    [filtered, favoriteSet],
  );

  const selectedItem = analyzed.find((a) => a.id === selectedId) || null;

  const renderCard = (item, showMuscle) => (
    <Grid item xs={12} sm={6} md={4} key={item.id}>
      <ExerciseProgressCard
        item={item}
        showMuscle={showMuscle}
        favorite={favoriteSet.has(item.id)}
        onToggleFavorite={toggleFavorite}
        onOpen={setSelectedId}
      />
    </Grid>
  );

  const renderContent = () => (
    <Grid container spacing={3}>
      {!isEmbedded && (
        <Grid item xs={12}>
          <Typography variant="h4" gutterBottom>{t('progress.title')}</Typography>
          <Typography variant="body1" color="text.secondary" paragraph>{t('progress.intro')}</Typography>
        </Grid>
      )}

      {isLoading ? (
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
        </Grid>
      ) : analyzed.length === 0 ? (
        <Grid item xs={12}>
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary' }}>
              {hasLoadError ? t('progress.error.connection') : t('progress.error.no_history')}
            </Typography>
          </Card>
        </Grid>
      ) : (
        <>
          <Grid item xs={12}>
            <Card sx={{ p: '20px 22px' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, mb: 1.5 }}>
                {t('progress.summary.title', { days: RECENT_DAYS })}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <SummaryStat label={t('progress.summary.improving')} value={summary.improving} color="success.main" />
                <SummaryStat label={t('progress.summary.stalled')} value={summary.stalled} />
                {summary.declining > 0 && (
                  <SummaryStat label={t('progress.summary.declining')} value={summary.declining} color="error.main" />
                )}
                <SummaryStat label={t('progress.summary.prs')} value={summary.prs.length} color={summary.prs.length ? 'primary.main' : undefined} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
                {summary.prs.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('progress.summary.prs_none')}</Typography>
                ) : (
                  <>
                    {summary.prs.slice(0, MAX_PR_CHIPS).map((a) => (
                      <Chip key={a.id} size="small" color="primary" variant="outlined" label={`${t('progress.pr')} · ${a.name}`} onClick={() => setSelectedId(a.id)} />
                    ))}
                    {summary.prs.length > MAX_PR_CHIPS && (
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>+{summary.prs.length - MAX_PR_CHIPS}</Typography>
                    )}
                  </>
                )}
              </Box>
            </Card>
          </Grid>

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
          </Grid>

          {filtered.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>{t('progress.search_empty')}</Typography>
            </Grid>
          )}

          {favoriteItems.length > 0 && (
            <Grid item xs={12}>
              <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 15, mb: 1.5 }}>{t('progress.favorites')}</Typography>
              <Grid container spacing={2}>{favoriteItems.map((item) => renderCard(item, true))}</Grid>
            </Grid>
          )}

          {sections.map((section, index) => {
            const isOpen = searching || (expanded[section.muscle] ?? index < OPEN_SECTIONS_DEFAULT);
            const label = section.muscle === 'other' ? t('progress.muscle_other') : muscleLabel(section.muscle);
            return (
              <Grid item xs={12} key={section.muscle}>
                <Accordion
                  disableGutters
                  expanded={isOpen}
                  onChange={(_, value) => setExpanded((prev) => ({ ...prev, [section.muscle]: value }))}
                  sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: '12px !important', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 16 }}>
                        {label} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 13 }}>· {t('progress.section_count', { count: section.items.length })}</Box>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {section.improving > 0 && `${t('progress.section_improving', { count: section.improving })} · `}
                        {t('progress.last_session', { when: formatDaysAgo(t, section.lastDays) })}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
                    <Grid container spacing={2}>{section.items.map((item) => renderCard(item, false))}</Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            );
          })}
        </>
      )}
    </Grid>
  );

  return (
    <>
      {isEmbedded ? (
        <Box sx={{ py: 2 }}>{renderContent()}</Box>
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>{renderContent()}</Container>
      )}

      <ExerciseDetailDialog
        item={selectedItem}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
};

export default Progress;

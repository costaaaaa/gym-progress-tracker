import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Card, CircularProgress, Link as MuiLink, Snackbar, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import RecordWorkoutDialog from '../components/RecordWorkoutDialog';
import { usePageMeta } from '../hooks/usePageMeta';
import { useNavigationRequest, useOncePerRequest } from '../hooks/useNavigationRequest';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../i18n/format';
import { clockDate } from '../utils/calendarDay';
import { focusedElement } from '../utils/focus';
import { NEUTRAL_OUTLINED, NEUTRAL_TEXT } from '../utils/buttonStyles';
import useWorkoutHistory from './history/useWorkoutHistory';
import useActivePlan from './history/useActivePlan';
import useUndoableWorkoutDelete from './history/useUndoableWorkoutDelete';
import WorkoutListItem from './history/WorkoutListItem';

// Gli allenamenti (già dal più recente) raggruppati per mese; la data illeggibile va in un gruppo a parte.
// Pura: vive fuori dal componente per avere un'identità stabile nelle dipendenze del useMemo che la usa.
const groupWorkoutsByMonth = (workouts) => {
  const grouped = {};
  workouts.forEach((workout) => {
    // `date` è l'orologio del luogo: il mese è quello scritto, in qualunque fuso sia il browser
    const date = clockDate(workout.date);
    const key = isNaN(date.getTime()) ? '0/0' : `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(workout);
  });
  return grouped;
};

// Pagina «Storico» (/storico): l'elenco compatto, un mese per card con una riga-collegamento per allenamento (la sua
// pagina è /storico/:id). `refreshHistory` (stato di navigazione, a fine allenamento) rilegge l'elenco; `openRecord` (dal
// ventaglio) apre la finestra «Registra allenamento passato», solo con una scheda attiva (senza, un avviso lo dice).
// Eliminato un allenamento dalla sua pagina si torna qui, e l'eliminazione resta annullabile per 10 secondi.
const History = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isLoggedIn, loading: authLoading, weightUnit } = useAuth();
  const recordRequest = useNavigationRequest('openRecord');
  usePageMeta(t('nav.history'), t('history.meta.description'));
  const { workouts: allWorkouts, summaries, loading, loadFailed, snackbar, notify, closeSnackbar, refresh } = useWorkoutHistory({ refreshKey: location.state?.refreshHistory });
  const { activePlan, planLoaded, planReadFailed } = useActivePlan();
  const { hiddenIds, pendingId, undo: undoDelete, holdProps: undoHoldProps } = useUndoableWorkoutDelete(notify);
  const workouts = useMemo(() => allWorkouts.filter((workout) => !hiddenIds.includes(workout.id)), [allWorkouts, hiddenIds]);
  const [openRecordDialog, setOpenRecordDialog] = useState(false);

  // Si apre una volta per richiesta, e solo con una scheda attiva (come il pulsante della pagina)
  useOncePerRequest(recordRequest, planLoaded, () => {
    if (planReadFailed) return; // la scheda non si è letta: non si sa se manca, niente avviso
    if (activePlan) setOpenRecordDialog(true);
    else notify(t('history.record_needs_plan'), 'info');
  });

  const handleRecordWorkout = (success, errorMessage, info) => {
    setOpenRecordDialog(false);
    if (success) {
      // Già salvato al primo invio: i valori modificati dopo non sono stati salvati
      notify(info?.alreadySaved ? t('focus.already_saved') : t('history.recorded'), 'success');
      refresh();
    } else if (errorMessage) {
      // errorMessage assente = l'utente ha premuto "Annulla" nel dialog, non è un errore da segnalare
      notify(errorMessage, 'error');
    }
  };

  // Tastiera: col messaggio «Annulla» il fuoco va sul pulsante; quando il messaggio finisce (e il fuoco era lì o è andato
  // perso su body) torna nell'elenco: sulla riga ripristinata, o sulla pagina
  const undoButtonRef = useRef(null);
  const contentRef = useRef(null);
  const previousPendingId = useRef(null);
  useEffect(() => {
    const previous = previousPendingId.current;
    previousPendingId.current = pendingId;
    if (pendingId !== null) { undoButtonRef.current?.focus(); return; }
    if (previous === null) return;
    const active = focusedElement();
    if (active && !undoButtonRef.current?.contains(active)) return;
    const root = contentRef.current;
    const target = (!hiddenIds.includes(previous) && root?.querySelector(`[data-workout-row="${previous}"]`)) || root;
    target?.focus();
  }, [pendingId, hiddenIds]);

  const groupedWorkouts = useMemo(() => groupWorkoutsByMonth(workouts), [workouts]);
  const monthName = (key) => {
    const [month, year] = key.split('/');
    return formatDate(`${year}-${month.padStart(2, '0')}-01`, { month: 'long', year: 'numeric' });
  };

  const body = () => {
    if (authLoading || (isLoggedIn && loading)) {
      return <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>;
    }
    if (!isLoggedIn) {
      return (
        <Card sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 16, mb: 2 }}>{t('history.login_prompt')}</Typography>
          <MuiLink component={Link} to="/login" color="primary.text" sx={{ fontWeight: 'bold' }}>{t('history.go_login')}</MuiLink>
        </Card>
      );
    }
    if (loadFailed) {
      return (
        <Alert severity="error" action={<Button color="inherit" onClick={refresh} sx={{ minHeight: 44, fontWeight: 600 }}>{t('history.retry')}</Button>}>
          {t('history.load_error')}
        </Alert>
      );
    }
    if (workouts.length === 0) {
      return (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">{t('history.empty')}</Typography>
          {activePlan && (
            <Button variant="outlined" sx={{ ...NEUTRAL_OUTLINED, mt: 3, minHeight: 44, fontWeight: 600 }} onClick={() => setOpenRecordDialog(true)}>
              {t('history.record_first')}
            </Button>
          )}
        </Card>
      );
    }
    return Object.entries(groupedWorkouts).map(([key, inMonth]) => {
      const headingId = `history-month-${key.replace('/', '-')}`;
      return (
        <Card key={key} component="section" aria-labelledby={headingId} sx={{ mb: 3.5 }}>
          <Typography id={headingId} component="h2" variant="cardTitle" sx={{ px: 2.5, pt: 2, pb: 1 }}>
            {key === '0/0' ? t('history.unknown_date') : monthName(key)}
          </Typography>
          <Box component="ul" sx={{ m: 0, p: 0 }}>
            {inMonth.map((workout) => (
              <WorkoutListItem key={workout.id} workout={workout} summary={summaries[workout.id]} weightUnit={weightUnit} />
            ))}
          </Box>
        </Card>
      );
    });
  };

  return (
    <Box ref={contentRef} tabIndex={-1} sx={{ py: 3, '&:focus': { outline: 'none' } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="pageTitle">{t('nav.history')}</Typography>
        {isLoggedIn && activePlan && (
          <Button onClick={() => setOpenRecordDialog(true)} sx={{ ...NEUTRAL_TEXT, minHeight: 44, fontWeight: 600 }}>
            {t('history.record_past')}
          </Button>
        )}
      </Box>

      {body()}

      {activePlan && <RecordWorkoutDialog open={openRecordDialog} onClose={handleRecordWorkout} activePlan={activePlan} />}
      <Snackbar
        open={pendingId !== null}
        message={t('history.delete.removed')}
        {...undoHoldProps}
        action={<Button ref={undoButtonRef} color="inherit" size="small" onClick={undoDelete} sx={{ minHeight: 44 }}>{t('history.delete.undo')}</Button>}
      />
      {/* Con l'«Annulla» in attesa gli altri messaggi stanno sopra, senza coprirlo */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} sx={pendingId !== null ? { bottom: 88 } : undefined} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default History;

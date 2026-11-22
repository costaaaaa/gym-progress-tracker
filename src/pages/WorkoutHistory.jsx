import { useState, useEffect, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Typography,
  Paper,
  Box,
  List,
  ButtonBase,
  CircularProgress,
  Alert,
  Snackbar,
  Link as MuiLink,
  Button,
  Collapse,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link } from 'react-router-dom';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import RecordWorkoutDialog from '../components/RecordWorkoutDialog';
import EditWorkoutDateDialog from '../components/EditWorkoutDateDialog';
import ShareCardDialog from '../components/ShareCardDialog';
import { track } from '../utils/analytics';
import { focusedElement } from '../utils/focus';
import { useAuth } from '../context/AuthContext';
import { isModuleActive } from '../hooks/useModule';
import { useOncePerRequest } from '../hooks/useNavigationRequest';
import { radius } from '../theme/radius';
import { intlLocale } from '../i18n/format';
import { clockDate, clockDay } from '../utils/calendarDay';
import { TITLE_FONT_FAMILY } from '../utils/fonts';
import useWorkoutHistory from './history/useWorkoutHistory';
import WorkoutRow from './history/WorkoutRow';
import DeleteWorkoutDialog from './history/DeleteWorkoutDialog';

// Pura, dipende solo dal parametro: vive fuori dal componente per avere
// un'identità stabile (react-hooks/exhaustive-deps altrimenti la vorrebbe
// ricreata a ogni render nelle dipendenze del useMemo che la usa sotto).
const groupWorkoutsByMonth = (workouts) => {
  const grouped = {};
  workouts.forEach(workout => {
    // `date` è l'orologio del luogo: il mese è quello scritto, in qualunque fuso sia il browser
    const date = clockDate(workout.date);
    if (!isNaN(date.getTime())) {
      const monthYear = `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
      if (!grouped[monthYear]) grouped[monthYear] = [];
      grouped[monthYear].push(workout);
    } else {
      if (!grouped['0/0']) grouped['0/0'] = [];
      grouped['0/0'].push(workout);
    }
  });
  return grouped;
};

// `recordRequest`: un numero che cresce a ogni richiesta di aprire «Registra allenamento» (dal ventaglio); si apre
// una volta per numero, e solo con una scheda attiva (come il pulsante della pagina); senza, un avviso lo dice
const WorkoutHistory = ({ isEmbedded = false, refreshKey = null, recordRequest = null }) => {
  const { t } = useTranslation();
  const { isLoggedIn, loading: authLoading, weightUnit, user } = useAuth();
  // Punti, streak e traguardi nelle anteprime sono del modulo Livelli: non attivo = non si mostrano
  const levelsOn = isModuleActive(user, 'levels');
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const {
    visibleWorkouts, loading, activePlan, planLoaded, planReadFailed,
    snackbar, notify, closeSnackbar, refresh,
    hiddenIds, pendingId, deleteWorkout, undoDelete, undoHoldProps, previewDelete,
    moveWorkoutDate, buildShareCard,
  } = useWorkoutHistory({ refreshKey });
  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [openEditDateDialog, setOpenEditDateDialog] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState(null);
  // Il mese corrente parte aperto già al primo render (con un effetto le righe comparivano un attimo chiuse)
  const [expandedMonths, setExpandedMonths] = useState(() => {
    const now = new Date();
    return { [`${now.getMonth() + 1}/${now.getFullYear()}`]: true }; // formato MM/YYYY
  });
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [shareStats, setShareStats] = useState(null); // card da condividere, null = dialog chiuso

  useOncePerRequest(recordRequest, planLoaded, () => {
    if (planReadFailed) return; // la scheda non si è letta: non si sa se manca, niente avviso
    if (activePlan) setOpenRecordDialog(true);
    else notify(t('history.record_needs_plan'), 'info');
  });

  // Espande/collassa il dettaglio esercizi inline di un allenamento (ex WorkoutDetailDialog)
  const toggleWorkoutExpansion = (workoutId) => {
    setExpandedWorkouts(prev => ({ ...prev, [workoutId]: !prev[workoutId] }));
  };

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

  const handleDeleteClick = (workout, event) => {
    event.stopPropagation();
    setWorkoutToDelete(workout);
  };

  const handleCloseDeleteDialog = () => {
    setWorkoutToDelete(null);
  };

  // Tastiera: col messaggio «Annulla» il fuoco va sul pulsante; quando il messaggio finisce (e il fuoco era
  // lì o è andato perso su body) torna nella lista: sulla riga ripristinata, o sull'intestazione del mese
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
    const target = (!hiddenIds.includes(previous) && root?.querySelector(`[data-workout-row="${previous}"]`))
      || root?.querySelector('[data-month-header]') || root;
    target?.focus();
  }, [pendingId, hiddenIds]);

  const handleConfirmDelete = (workout) => {
    deleteWorkout(workout.id);
    handleCloseDeleteDialog();
  };

  const handleShareClick = (workout) => {
    setShareStats(buildShareCard(workout));
    track('workout_card', { action: 'open', from: 'history' });
  };

  // Il server sposta solo gli allenamenti degli ultimi 30 giorni
  const oldestMovable = useMemo(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'), []);

  const isTooOldToMove = (workout) => {
    const day = clockDay(workout.date);
    return day !== null && day < oldestMovable;
  };

  const handleEditDateClick = (workout, event) => {
    event.stopPropagation();
    setWorkoutToEdit(workout);
    setOpenEditDateDialog(true);
  };

  const handleCloseEditDateDialog = () => {
    setOpenEditDateDialog(false);
    setWorkoutToEdit(null);
  };

  const getMonthName = (monthNum) => {
    const name = new Date(2000, monthNum - 1, 1).toLocaleDateString(intlLocale(), { month: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const toggleMonthExpansion = (monthYear) => {
    setExpandedMonths(prev => ({ ...prev, [monthYear]: !prev[monthYear] }));
  };

  const groupedWorkouts = useMemo(() => groupWorkoutsByMonth(visibleWorkouts), [visibleWorkouts]);

  const renderContent = () => (
    <Box ref={contentRef} tabIndex={-1} sx={{ pt: isEmbedded ? 0 : 3, pb: 6, '&:focus': { outline: 'none' } }}>
      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', mb: 3 }}>
        {!isEmbedded && (
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20 }}>
            {t('history.title')}
          </Typography>
        )}
        {isLoggedIn && activePlan && (
          <Button
            variant="contained"
            onClick={() => setOpenRecordDialog(true)}
            startIcon={<AssignmentIcon fontSize="small" />}
            sx={{ fontSize: 16, fontWeight: 600 }}
          >
            {t('record.title')}
          </Button>
        )}
      </Box>

      {authLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
      ) : !isLoggedIn ? (
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>{t('history.login_prompt')}</Typography>
          <MuiLink component={Link} to="/login" color="primary.text" sx={{ fontWeight: 'bold' }}>{t('history.go_login')}</MuiLink>
        </Paper>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
      ) : visibleWorkouts.length === 0 ? (
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h6">{t('history.empty')}</Typography>
          {activePlan && (
            <Button variant="outlined" sx={{ mt: 3 }} onClick={() => setOpenRecordDialog(true)}>{t('history.record_first')}</Button>
          )}
        </Paper>
      ) : (
        Object.entries(groupedWorkouts).map(([monthYear, workoutsInMonth]) => {
          const [month, year] = monthYear.split('/');
          const isExpanded = expandedMonths[monthYear] || false;
          const isUnknownDate = monthYear === '0/0';

          const monthPanelId = `month-panel-${monthYear.replace('/', '-')}`;

          return (
            <Box key={monthYear} sx={{ mb: 3.5 }}>
              {/* Tutta l'intestazione del mese apre e chiude, non solo la freccia */}
              <ButtonBase
                onClick={() => toggleMonthExpansion(monthYear)}
                aria-expanded={isExpanded}
                aria-controls={monthPanelId}
                data-month-header
                sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.75, py: 0.5, borderRadius: radius.xxl, textAlign: 'left' }}
              >
                <Typography component="span" variant="cardTitle">
                  {isUnknownDate ? t('history.unknown_date') : `${getMonthName(parseInt(month))} ${year}`}
                </Typography>
                <Box component="span" sx={{ display: 'flex', p: 0.625, color: 'text.secondary' }}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
              </ButtonBase>
              <Collapse in={isExpanded} id={monthPanelId} timeout="auto">
                <Paper sx={{ overflow: 'hidden' }}>
                  <List sx={{ p: 0 }}>
                    {workoutsInMonth.map((workout, index) => (
                      <WorkoutRow
                        key={workout.id}
                        workout={workout}
                        isPhone={isPhone}
                        expanded={!!expandedWorkouts[workout.id]}
                        onToggle={toggleWorkoutExpansion}
                        dateLocked={isTooOldToMove(workout)}
                        showDivider={index < workoutsInMonth.length - 1}
                        weightUnit={weightUnit}
                        onShare={handleShareClick}
                        onEditDate={handleEditDateClick}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </List>
                </Paper>
              </Collapse>
            </Box>
          );
        })
      )}
    </Box>
  );

  return (
    <>
      {isEmbedded ? renderContent() : <Box sx={{ py: 2 }}>{renderContent()}</Box>}
      {activePlan && <RecordWorkoutDialog open={openRecordDialog} onClose={handleRecordWorkout} activePlan={activePlan} />}
      <DeleteWorkoutDialog
        workout={workoutToDelete}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        loadPreview={previewDelete}
        levelsOn={levelsOn}
        weightUnit={weightUnit}
      />
      <ShareCardDialog open={!!shareStats} stats={shareStats} weightUnit={weightUnit} onClose={() => setShareStats(null)} />
      <EditWorkoutDateDialog open={openEditDateDialog} onClose={handleCloseEditDateDialog} workout={workoutToEdit} onUpdateSuccess={moveWorkoutDate} weightUnit={weightUnit} showLevels={levelsOn} />
      <Snackbar
        open={pendingId !== null}
        message={t('history.delete.removed')}
        {...undoHoldProps}
        action={<Button ref={undoButtonRef} color="inherit" size="small" onClick={undoDelete}>{t('history.delete.undo')}</Button>}
      />
      {/* Con l'«Annulla» in attesa gli altri messaggi stanno sopra, senza coprirlo */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} sx={pendingId !== null ? { bottom: 88 } : undefined} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
};

export default WorkoutHistory;

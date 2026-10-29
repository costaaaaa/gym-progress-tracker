import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Typography,
  Paper,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ButtonBase,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
  Container,
  Link as MuiLink,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Collapse,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import RecordWorkoutDialog from '../components/RecordWorkoutDialog';
import EditWorkoutDateDialog from '../components/EditWorkoutDateDialog';
import ShareCardDialog from '../components/ShareCardDialog';
import useUndoableDelete from '../hooks/useUndoableDelete';
import { buildShareStats, historyRecords, muscleGroupsTitle } from '../utils/shareCard';
import { track } from '../utils/analytics';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { intlLocale } from '../i18n/format';
import { clockDate, formatClockDate, formatClockTime } from '../utils/workoutTime';
import TimeZoneBadge from '../components/TimeZoneBadge';
import { muscleLabel, techniqueLabel } from '../i18n/labels';
import { achievementCatalog } from '../utils/gamificationLevels';
import { TITLE_FONT_FAMILY } from '../utils/fonts';

// Determina il formato dei dati e organizza gli esercizi di un allenamento in modo uniforme
// (ex helper interno di WorkoutDetailDialog: il backend restituisce righe storiche in due forme
// diverse — array `sets` oppure campi flat weight/reps/set_number — da normalizzare qui).
const organizeExercises = (exercises) => {
  if (!Array.isArray(exercises)) return [];

  return exercises.map((exercise, index) => {
    const exerciseCopy = JSON.parse(JSON.stringify(exercise));

    exerciseCopy.id = exercise.exercise_id ||
      (exercise.name ? `temp-${exercise.name.toLowerCase().replace(/\s+/g, '-')}` : `unknown-${index}`);
    exerciseCopy.name = exercise.exercise_name || exercise.name || 'Esercizio senza nome';

    if (!exerciseCopy.sets) {
      exerciseCopy.sets = [{
        set_number: exercise.set_number || 1,
        weight: exercise.weight || 0,
        reps: exercise.reps || 0,
        intensity_technique: exercise.intensity_technique || null
      }];
    }

    return exerciseCopy;
  });
};

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

const newestFirst = (a, b) => clockDate(b.date) - clockDate(a.date);

const WorkoutHistory = ({ isEmbedded = false, refreshKey = null }) => {
  const { t } = useTranslation();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [rowMenu, setRowMenu] = useState(null); // { anchor, workout } del menu "Altre azioni", null = chiuso
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activePlan, setActivePlan] = useState(null);
  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null); // cosa si perde cancellando, dall'anteprima del server
  const [openEditDateDialog, setOpenEditDateDialog] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState(null);
  // Il mese corrente parte aperto già al primo render (con un effetto le righe comparivano un attimo chiuse)
  const [expandedMonths, setExpandedMonths] = useState(() => {
    const now = new Date();
    return { [`${now.getMonth() + 1}/${now.getFullYear()}`]: true }; // formato MM/YYYY
  });
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [shareStats, setShareStats] = useState(null); // card da condividere, null = dialog chiuso

  useEffect(() => {
    if (authLoading) return;

    if (isLoggedIn) {
      fetchWorkoutHistory();
      fetchActivePlan();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshKey && isLoggedIn) {
      fetchWorkoutHistory();
    }
  }, [refreshKey, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchActivePlan = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/read_plans.php`);
      const data = await response.json();
      if (data.records) {
        const active = data.records.find(plan => plan.is_active);
        setActivePlan(active || null);
      }
    } catch (error) {
      console.error('Error fetching active plan:', error);
    }
  };

  const fetchWorkoutHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      // 404 = nessun allenamento registrato: lista vuota, non un errore
      if (!response.ok && response.status !== 404) {
        throw new Error(data.message || t('history.load_error'));
      }
      if (data.records && Array.isArray(data.records)) {
        const sortedWorkouts = data.records.sort(newestFirst);
        setWorkouts(sortedWorkouts);
      } else {
        setWorkouts([]);
      }
    } catch (error) {
      console.error('Error fetching workout history:', error);
      setSnackbar({
        open: true,
        message: t('history.load_error_detail', { message: error.message || t('history.unknown_error') }),
        severity: 'error'
      });
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  // Espande/collassa il dettaglio esercizi inline di un allenamento (ex WorkoutDetailDialog)
  const toggleWorkoutExpansion = (workoutId) => {
    setExpandedWorkouts(prev => ({ ...prev, [workoutId]: !prev[workoutId] }));
  };

  const handleRecordWorkout = (success, errorMessage, info) => {
    setOpenRecordDialog(false);
    if (success) {
      setSnackbar({
        open: true,
        // Già salvato al primo invio: i valori modificati dopo non sono stati salvati
        message: info?.alreadySaved ? t('focus.already_saved') : t('history.recorded'),
        severity: 'success'
      });
      fetchWorkoutHistory();
    } else if (errorMessage) {
      // errorMessage assente = l'utente ha premuto "Annulla" nel dialog, non è un errore da segnalare
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  };
  
  const handleDeleteClick = (workout, event) => {
    event.stopPropagation();
    setWorkoutToDelete(workout);
    setOpenDeleteDialog(true);
  };
  
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setWorkoutToDelete(null);
    setDeletePreview(null);
  };

  // Alla conferma il server dice cosa si perderebbe; se l'anteprima non arriva il dialogo resta quello base
  useEffect(() => {
    if (!workoutToDelete) return undefined;
    let cancelled = false;
    fetch(`${API_BASE_URL}api/workout_history/delete.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: workoutToDelete.id, preview: true }),
      credentials: 'include'
    })
      .then(response => (response.ok ? response.json() : null))
      .then(data => { if (!cancelled && data?.success) setDeletePreview(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workoutToDelete]);
  
  // La riga sparisce subito; la richiesta al server parte solo allo scadere dell'«Annulla» (vedi useUndoableDelete)
  const { hiddenIds, pendingId, schedule: scheduleDelete, undo: undoDelete } = useUndoableDelete({
    commit: async (id) => {
      const response = await fetch(`${API_BASE_URL}api/workout_history/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || t('history.delete.error'));
      }
    },
    onError: (error) => setSnackbar({ open: true, message: error.message, severity: 'error' }),
  });

  const handleConfirmDelete = () => {
    if (!workoutToDelete) return;
    scheduleDelete(workoutToDelete.id);
    handleCloseDeleteDialog();
  };

  const handleShareClick = (workout) => {
    setShareStats(buildShareStats({
      exercises: workout.exercises,
      date: workout.date,
      durationSec: workout.duration_seconds,
      title: muscleGroupsTitle(workout.exercises, muscleLabel),
      records: historyRecords(visibleWorkouts, workout),
    }));
    track('workout_card', { action: 'open', from: 'history' });
  };

  // Il server sposta solo gli allenamenti degli ultimi 30 giorni
  const oldestMovable = useMemo(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'), []);

  const handleEditDateClick = (workout, event) => {
    event.stopPropagation();
    setWorkoutToEdit(workout);
    setOpenEditDateDialog(true);
  };
  
  // Le azioni di una riga: le usano le icone (desktop) e il menu (telefono); un gesto di swipe potrà usare le stesse
  const rowActions = (workout) => [
    { key: 'share', label: t('history.share_aria'), icon: <ShareIcon fontSize="small" />, run: () => handleShareClick(workout) },
    {
      key: 'edit-date', label: t('history.edit_date_aria'), icon: <EditCalendarIcon fontSize="small" />,
      disabled: String(workout.date).slice(0, 10) < oldestMovable, disabledHint: t('history.date.too_old'),
      run: (e) => handleEditDateClick(workout, e),
    },
    { key: 'delete', label: t('history.delete_aria'), icon: <DeleteIcon fontSize="small" />, run: (e) => handleDeleteClick(workout, e) },
  ];

  const handleCloseEditDateDialog = () => {
    setOpenEditDateDialog(false);
    setWorkoutToEdit(null);
  };
  
  const handleUpdateDateSuccess = (workoutId, moved) => {
    setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, ...moved } : w).sort(newestFirst));
    setSnackbar({ open: true, message: t('history.date.updated'), severity: 'success' });
  };

  const getMonthName = (monthNum) => {
    const name = new Date(2000, monthNum - 1, 1).toLocaleDateString(intlLocale(), { month: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const toggleMonthExpansion = (monthYear) => {
    setExpandedMonths(prev => ({ ...prev, [monthYear]: !prev[monthYear] }));
  };

  const visibleWorkouts = useMemo(() => workouts.filter(w => !hiddenIds.includes(w.id)), [workouts, hiddenIds]);
  const groupedWorkouts = useMemo(() => groupWorkoutsByMonth(visibleWorkouts), [visibleWorkouts]);

  // Dettaglio esercizi inline di un allenamento (ex contenuto di WorkoutDetailDialog)
  const renderWorkoutExerciseDetails = (workout) => {
    const exercises = organizeExercises(workout.exercises);
    const hasExercises = exercises.length > 0;

    return (
      <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
        {workout.notes && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary', mb: 0.5 }}>
              {t('history.notes_caps')}
            </Typography>
            <Box sx={{
              bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf9f8' : 'action.hover',
              borderRadius: '10px', p: 1.5,
            }}>
              <Typography variant="body2">{workout.notes}</Typography>
            </Box>
          </Box>
        )}

        {!hasExercises ? (
          <Alert severity="info">{t('history.no_detail_workout')}</Alert>
        ) : (
          exercises.map((exercise, index) => (
            <Box key={exercise.id + '-' + index} sx={{ mb: index < exercises.length - 1 ? 2 : 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{exercise.name}</Typography>
                <Box sx={{
                  border: '1px solid', borderColor: 'divider', borderRadius: '8px',
                  px: 1.25, py: 0.4, fontSize: 12, fontWeight: 600, color: 'text.secondary', flexShrink: 0,
                }}>
                  {t('history.sets_count', { count: exercise.sets.length })}
                </Box>
              </Box>
              {exercise.sets.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {exercise.sets.map((set, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5,
                        bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf9f8' : 'action.hover',
                        borderRadius: '8px', px: 1.75, py: 1,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">{t('focus.set_n', { n: idx + 1 })}</Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{set.weight || 0} kg × {set.reps}</Typography>
                        {set.intensity_technique && (
                          <Typography variant="caption" color="text.secondary" display="block">{techniqueLabel(set.intensity_technique)}</Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                  {exercise.notes && (
                    <Typography variant="caption" color="text.secondary" fontStyle="italic">{t('history.exercise_notes', { notes: exercise.notes })}</Typography>
                  )}
                </Box>
              ) : (
                <Alert severity="warning">{t('history.no_detail_exercise')}</Alert>
              )}
            </Box>
          ))
        )}
      </Box>
    );
  };

  const renderContent = () => (
    <Box sx={{ pt: isEmbedded ? 0 : 3, pb: 6 }}>
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
          <MuiLink component={Link} to="/login" color="primary" sx={{ fontWeight: 'bold' }}>{t('history.go_login')}</MuiLink>
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
                sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.75, py: 0.5, borderRadius: 1, textAlign: 'left' }}
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
                    {workoutsInMonth.map((workout, index) => {
                      const isRowExpanded = !!expandedWorkouts[workout.id];
                      const rowPanelId = `workout-detail-panel-${workout.id}`;
                      return (
                        <React.Fragment key={workout.id}>
                          {/* La card intera apre i dettagli. Condividi, modifica e cestino stanno in
                              secondaryAction, fuori dal ListItemButton: il loro clic non apre la card. */}
                          <ListItem disablePadding sx={{ '& > .MuiListItemButton-root': { pr: isPhone ? 10 : 19 } }} secondaryAction={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {isPhone ? (
                                <IconButton onClick={(e) => setRowMenu({ anchor: e.currentTarget, workout })} size="small" sx={{ color: 'text.secondary' }} aria-label={t('history.more_actions_aria')}><MoreVertIcon fontSize="small" /></IconButton>
                              ) : rowActions(workout).map((action) => (action.disabled ? (
                                <Tooltip key={action.key} title={action.disabledHint}>
                                  <span><IconButton disabled size="small" aria-label={action.label}>{action.icon}</IconButton></span>
                                </Tooltip>
                              ) : (
                                <IconButton key={action.key} onClick={action.run} size="small" sx={{ color: 'text.secondary' }} aria-label={action.label}>{action.icon}</IconButton>
                              )))}
                              {/* Indicatore: per tastiera e lettori di schermo il comando è la card */}
                              <Box component="span" aria-hidden onClick={() => toggleWorkoutExpansion(workout.id)}
                                sx={{ display: 'flex', p: 0.625, color: 'text.secondary', cursor: 'pointer' }}>
                                {isRowExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </Box>
                            </Box>
                          }>
                            <ListItemButton
                              onClick={() => toggleWorkoutExpansion(workout.id)}
                              aria-expanded={isRowExpanded}
                              aria-controls={rowPanelId}
                            >
                              <ListItemText
                                primary={<Typography sx={{ fontWeight: 600, fontSize: 16 }}>{formatClockDate(workout.date, { weekday: 'long', day: 'numeric', month: 'long' })}</Typography>}
                                secondaryTypographyProps={{ component: 'div' }}
                                secondary={(
                                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.25 }}>
                                    <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{`${formatClockTime(workout.date)} · ${t('focus.exercises_count', { count: workout.exercises?.length || 0 })}`}</Typography>
                                    <TimeZoneBadge workout={workout} sx={{ fontSize: 16 }} />
                                  </Box>
                                )}
                              />
                            </ListItemButton>
                          </ListItem>
                          <Collapse component="li" in={isRowExpanded} id={rowPanelId} timeout="auto" sx={{ listStyle: 'none' }}>
                            {renderWorkoutExerciseDetails(workout)}
                          </Collapse>
                          {index < workoutsInMonth.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                      );
                    })}
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
      {isEmbedded ? renderContent() : <Container maxWidth="lg" sx={{ py: 2 }}>{renderContent()}</Container>}
      {activePlan && <RecordWorkoutDialog open={openRecordDialog} onClose={handleRecordWorkout} activePlan={activePlan} />}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>{t('history.delete.title')}</DialogTitle>
        <DialogContent>
          {t('history.delete.body')}
          {deletePreview?.xp_removed > 0 && (
            <Typography variant="body2" sx={{ mt: 1.5 }}>{t('history.delete.lose_xp', { xp: deletePreview.xp_removed })}</Typography>
          )}
          {deletePreview && deletePreview.streak_before !== deletePreview.streak_after && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('history.streak_change', { from: deletePreview.streak_before, to: deletePreview.streak_after })}
            </Typography>
          )}
          {(deletePreview?.achievements_removed ?? []).map(key => (
            <Typography key={key} variant="body2" sx={{ mt: 0.5 }}>
              {t('history.delete.lose_achievement', { label: achievementCatalog.find(a => a.key === key)?.label ?? key })}
            </Typography>
          ))}
          {workoutToDelete?.health_written && (
            <Typography variant="body2" sx={{ mt: 1.5 }}>{t('history.delete.health_note')}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">{t('history.delete.confirm')}</Button>
        </DialogActions>
      </Dialog>
      <Menu anchorEl={rowMenu?.anchor} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        {rowMenu && rowActions(rowMenu.workout).map((action) => (
          <MenuItem
            key={action.key}
            disabled={action.disabled}
            onClick={(e) => { setRowMenu(null); action.run(e); }}
            sx={{ maxWidth: 300 }}
          >
            <ListItemIcon sx={{ color: 'text.secondary' }}>{action.icon}</ListItemIcon>
            <ListItemText
              primary={action.label}
              secondary={action.disabled ? action.disabledHint : undefined}
              secondaryTypographyProps={{ sx: { whiteSpace: 'normal' } }}
            />
          </MenuItem>
        ))}
      </Menu>
      <ShareCardDialog open={!!shareStats} stats={shareStats} onClose={() => setShareStats(null)} />
      <EditWorkoutDateDialog open={openEditDateDialog} onClose={handleCloseEditDateDialog} workout={workoutToEdit} onUpdateSuccess={handleUpdateDateSuccess} />
      <Snackbar
        open={pendingId !== null}
        message={t('history.delete.removed')}
        action={<Button color="inherit" size="small" onClick={undoDelete}>{t('history.delete.undo')}</Button>}
      />
      {/* Con l'«Annulla» in attesa gli altri messaggi stanno sopra, senza coprirlo */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} sx={pendingId !== null ? { bottom: 88 } : undefined} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
};

export default WorkoutHistory;

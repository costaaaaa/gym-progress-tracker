import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Paper,
  Box,
  List,
  ListItem,
  ListItemText,
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
} from '@mui/material';
import { Link } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import RecordWorkoutDialog from '../components/RecordWorkoutDialog';
import EditWorkoutDateDialog from '../components/EditWorkoutDateDialog';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

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

const WorkoutHistory = ({ isEmbedded = false, refreshKey = null }) => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activePlan, setActivePlan] = useState(null);
  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openEditDateDialog, setOpenEditDateDialog] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWorkouts, setExpandedWorkouts] = useState({});

  useEffect(() => {
    if (authLoading) return;

    if (isLoggedIn) {
      fetchWorkoutHistory();
      fetchActivePlan();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, authLoading]);

  useEffect(() => {
    if (refreshKey && isLoggedIn) {
      fetchWorkoutHistory();
    }
  }, [refreshKey, isLoggedIn]);

  useEffect(() => {
    if (workouts.length > 0 && Object.keys(expandedMonths).length === 0) {
      const now = new Date();
      const monthYear = `${now.getMonth() + 1}/${now.getFullYear()}`; // formato MM/YYYY
      
      // Inizializza con il mese corrente espanso
      const initialExpanded = {};
      initialExpanded[monthYear] = true;
      setExpandedMonths(initialExpanded);
    }
  }, [workouts, expandedMonths]);

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
      if (!response.ok) {
        throw new Error(data.message || 'Errore nel caricamento della cronologia');
      }
      if (data.records && Array.isArray(data.records)) {
        const sortedWorkouts = data.records.sort((a, b) => new Date(b.date) - new Date(a.date));
        setWorkouts(sortedWorkouts);
      } else {
        setWorkouts([]);
      }
    } catch (error) {
      console.error('Error fetching workout history:', error);
      setSnackbar({
        open: true,
        message: 'Errore nel caricamento della cronologia: ' + (error.message || 'Errore sconosciuto'),
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

  const handleRecordWorkout = (success, errorMessage) => {
    setOpenRecordDialog(false);
    if (success) {
      setSnackbar({
        open: true,
        message: 'Allenamento registrato con successo',
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
  };
  
  const handleConfirmDelete = async () => {
    if (!workoutToDelete) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/workout_history/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workoutToDelete.id }),
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Errore durante l\'eliminazione');
      }
      setWorkouts(prev => prev.filter(w => w.id !== workoutToDelete.id));
      setSnackbar({ open: true, message: 'Allenamento eliminato con successo', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    } finally {
      setDeleteLoading(false);
      setOpenDeleteDialog(false);
      setWorkoutToDelete(null);
    }
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
  
  const handleUpdateDateSuccess = (workoutId, newDate) => {
    setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, date: newDate } : w).sort((a, b) => new Date(b.date) - new Date(a.date)));
    setSnackbar({ open: true, message: 'Data aggiornata con successo', severity: 'success' });
  };

  const groupWorkoutsByMonth = () => {
    const grouped = {};
    workouts.forEach(workout => {
      const date = new Date(workout.date);
      if (!isNaN(date.getTime())) {
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        if (!grouped[monthYear]) grouped[monthYear] = [];
        grouped[monthYear].push(workout);
      } else {
        if (!grouped['0/0']) grouped['0/0'] = [];
        grouped['0/0'].push(workout);
      }
    });
    return grouped;
  };

  const getMonthName = (monthNum) => {
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return months[monthNum - 1];
  };

  const toggleMonthExpansion = (monthYear) => {
    setExpandedMonths(prev => ({ ...prev, [monthYear]: !prev[monthYear] }));
  };

  const groupedWorkouts = useMemo(() => groupWorkoutsByMonth(), [workouts]);

  // Dettaglio esercizi inline di un allenamento (ex contenuto di WorkoutDetailDialog)
  const renderWorkoutExerciseDetails = (workout) => {
    const exercises = organizeExercises(workout.exercises);
    const hasExercises = exercises.length > 0;

    return (
      <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
        {workout.notes && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary', mb: 0.5 }}>
              NOTE
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
          <Alert severity="info">Nessun dettaglio disponibile per questo allenamento</Alert>
        ) : (
          exercises.map((exercise, index) => (
            <Box key={exercise.id + '-' + index} sx={{ mb: index < exercises.length - 1 ? 2 : 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{exercise.name}</Typography>
                <Box sx={{
                  border: '1px solid', borderColor: 'divider', borderRadius: '8px',
                  px: 1.25, py: 0.4, fontSize: 12, fontWeight: 600, color: 'text.secondary', flexShrink: 0,
                }}>
                  {exercise.sets.length} serie
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
                      <Typography variant="body2" color="text.secondary">Serie {idx + 1}</Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{set.weight || 0} kg × {set.reps}</Typography>
                        {set.intensity_technique && (
                          <Typography variant="caption" color="text.secondary" display="block">{set.intensity_technique}</Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                  {exercise.notes && (
                    <Typography variant="caption" color="text.secondary" fontStyle="italic">Note: {exercise.notes}</Typography>
                  )}
                </Box>
              ) : (
                <Alert severity="warning">Nessun dettaglio disponibile per questo esercizio</Alert>
              )}
            </Box>
          ))
        )}
      </Box>
    );
  };

  const renderContent = () => (
    <Box sx={{ pt: isEmbedded ? 0 : 3, pb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 20 }}>
          Cronologia Allenamenti
        </Typography>
        {isLoggedIn && activePlan && (
          <Button
            variant="contained"
            onClick={() => setOpenRecordDialog(true)}
            startIcon={<AssignmentIcon fontSize="small" />}
            sx={{ fontSize: 13, fontWeight: 600 }}
          >
            Registra Allenamento
          </Button>
        )}
      </Box>

      {authLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
      ) : !isLoggedIn ? (
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>Effettua il login per visualizzare la tua cronologia.</Typography>
          <MuiLink component={Link} to="/login" color="primary" sx={{ fontWeight: 'bold' }}>Vai al login</MuiLink>
        </Paper>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
      ) : workouts.length === 0 ? (
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h6">Nessun allenamento registrato</Typography>
          {activePlan && (
            <Button variant="outlined" sx={{ mt: 3 }} onClick={() => setOpenRecordDialog(true)}>Registra il primo</Button>
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.75 }}>
                <Typography sx={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 16, borderBottom: '2px solid', borderColor: 'primary.main', pb: 0.75 }}>
                  {isUnknownDate ? 'Data sconosciuta' : `${getMonthName(parseInt(month))} ${year}`}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => toggleMonthExpansion(monthYear)}
                  aria-expanded={isExpanded}
                  aria-controls={monthPanelId}
                  aria-label={isExpanded ? 'Nascondi mese' : 'Mostra mese'}
                  sx={{ color: 'text.secondary' }}
                >
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={isExpanded} id={monthPanelId} timeout="auto">
                <Paper sx={{ overflow: 'hidden' }}>
                  <List sx={{ p: 0 }}>
                    {workoutsInMonth.map((workout, index) => {
                      const isRowExpanded = !!expandedWorkouts[workout.id];
                      const rowPanelId = `workout-detail-panel-${workout.id}`;
                      return (
                        <React.Fragment key={workout.id}>
                          <ListItem secondaryAction={
                            <Box>
                              <IconButton onClick={(e) => handleEditDateClick(workout, e)} size="small" sx={{ color: 'text.secondary' }}><EditCalendarIcon fontSize="small" /></IconButton>
                              <IconButton onClick={(e) => handleDeleteClick(workout, e)} size="small" sx={{ color: 'text.secondary' }}><DeleteIcon fontSize="small" /></IconButton>
                              <IconButton
                                onClick={() => toggleWorkoutExpansion(workout.id)}
                                size="small"
                                sx={{ color: 'text.secondary' }}
                                aria-expanded={isRowExpanded}
                                aria-controls={rowPanelId}
                                aria-label={isRowExpanded ? 'Nascondi dettagli allenamento' : 'Mostra dettagli allenamento'}
                              >
                                {isRowExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </Box>
                          }>
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 600, fontSize: 14 }}>{new Date(workout.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Typography>}
                              secondary={<Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{`${new Date(workout.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · ${workout.exercises?.length || 0} esercizi`}</Typography>}
                            />
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
        <DialogTitle>Conferma eliminazione</DialogTitle>
        <DialogContent>Sei sicuro di voler eliminare questo allenamento?</DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Annulla</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleteLoading}>Elimina</Button>
        </DialogActions>
      </Dialog>
      <EditWorkoutDateDialog open={openEditDateDialog} onClose={handleCloseEditDateDialog} workout={workoutToEdit} onUpdateSuccess={handleUpdateDateSuccess} />
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
};

export default WorkoutHistory;

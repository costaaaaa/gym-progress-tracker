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
  Fab,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider
} from '@mui/material';
import { Link } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import WorkoutDetailDialog from '../components/WorkoutDetailDialog';
import RecordWorkoutDialog from '../components/RecordWorkoutDialog';
import EditWorkoutDateDialog from '../components/EditWorkoutDateDialog';
import { API_BASE_URL } from '../config';

const WorkoutHistory = ({ isEmbedded = false, refreshKey = null }) => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activePlan, setActivePlan] = useState(null);
  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openEditDateDialog, setOpenEditDateDialog] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    // Check if user is logged in
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);

    if (loggedIn) {
      fetchWorkoutHistory();
      fetchActivePlan();
    } else {
      setLoading(false);
    }
  }, []);

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

  const handleOpenWorkoutDetail = (workout) => {
    setSelectedWorkout(workout);
    setOpenDetailDialog(true);
  };

  const handleCloseWorkoutDetail = () => {
    setOpenDetailDialog(false);
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
    } else {
      setSnackbar({
        open: true,
        message: errorMessage || 'Errore durante la registrazione dell\'allenamento',
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
  const now = new Date();
  const currentMonthYear = `${now.getMonth() + 1}/${now.getFullYear()}`;

  const renderContent = () => (
    <Box sx={{ pt: isEmbedded ? 0 : 3, pb: 6 }}>
      {!isEmbedded && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarTodayIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
              Cronologia Allenamenti
            </Typography>
          </Box>
          {isLoggedIn && activePlan && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setOpenRecordDialog(true)}
              startIcon={<AssignmentIcon />}
              sx={{ py: 1.2, px: 3, fontWeight: 'bold' }}
            >
              Registra Allenamento
            </Button>
          )}
        </Box>
      )}

      {isLoggedIn && isEmbedded && activePlan && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenRecordDialog(true)}
            startIcon={<AssignmentIcon />}
          >
            Registra Allenamento
          </Button>
        </Box>
      )}

      {!isLoggedIn ? (
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
          
          return (
            <Box key={monthYear} sx={{ mb: 4 }}>
              <Box 
                onClick={() => toggleMonthExpansion(monthYear)}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', mb: 2 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold', borderBottom: '2px solid', borderColor: 'primary.main', pb: 1 }}>
                  {isUnknownDate ? 'Data sconosciuta' : `${getMonthName(parseInt(month))} ${year}`}
                </Typography>
                <IconButton size="small">{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
              </Box>
              {isExpanded && (
                <Paper elevation={2}>
                  <List sx={{ p: 0 }}>
                    {workoutsInMonth.map((workout, index) => (
                      <ListItem key={workout.id} divider={index < workoutsInMonth.length - 1} secondaryAction={
                        <Box>
                          <IconButton onClick={(e) => handleEditDateClick(workout, e)} color="primary"><EditCalendarIcon /></IconButton>
                          <IconButton onClick={(e) => handleDeleteClick(workout, e)} color="error"><DeleteIcon /></IconButton>
                          <IconButton onClick={() => handleOpenWorkoutDetail(workout)} color="primary"><VisibilityIcon /></IconButton>
                        </Box>
                      }>
                        <ListItemText 
                          primary={<Typography sx={{ fontWeight: 'medium' }}>{new Date(workout.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Typography>}
                          secondary={`${new Date(workout.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} • ${workout.exercises?.length || 0} esercizi`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );

  return (
    <>
      {isEmbedded ? renderContent() : <Container maxWidth="lg" sx={{ py: 2 }}>{renderContent()}</Container>}
      <WorkoutDetailDialog open={openDetailDialog} onClose={handleCloseWorkoutDetail} workout={selectedWorkout} />
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

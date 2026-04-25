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
  DialogTitle
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

const WorkoutHistory = () => {
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
      console.log("🔄 Recupero storico allenamenti...");
      
      const response = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      console.log("📦 Dati ricevuti:", data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Errore nel caricamento della cronologia');
      }
      
      if (data.records && Array.isArray(data.records)) {
        // Ordina per data, dal più recente al più vecchio
        const sortedWorkouts = data.records.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Debug: controlla struttura dei dati
        if (sortedWorkouts.length > 0) {
          console.log(`✅ Recuperati ${sortedWorkouts.length} allenamenti`);
          console.log("📊 Struttura primo allenamento:", sortedWorkouts[0]);
          
          // Verifica la presenza di esercizi
          if (sortedWorkouts[0].exercises) {
            console.log(`🏋️ Il primo allenamento contiene ${sortedWorkouts[0].exercises.length} esercizi`);
          } else {
            console.warn("⚠️ Nessun esercizio trovato nel primo allenamento");
          }
        }
        
        setWorkouts(sortedWorkouts);
      } else {
        console.warn('❌ Formato dati non corretto nella risposta:', data);
        setWorkouts([]);
      }
    } catch (error) {
      console.error('❌ Error fetching workout history:', error);
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
      // Ricarica la lista degli allenamenti dopo aver registrato un nuovo allenamento
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
    // Previene il click del bottone di dettaglio
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: workoutToDelete.id
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Errore durante l\'eliminazione dell\'allenamento');
      }
      
      // Aggiorna la lista degli allenamenti rimuovendo quello eliminato
      setWorkouts(prevWorkouts => prevWorkouts.filter(w => w.id !== workoutToDelete.id));
      
      setSnackbar({
        open: true,
        message: 'Allenamento eliminato con successo',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting workout:', error);
      setSnackbar({
        open: true,
        message: 'Errore durante l\'eliminazione: ' + (error.message || 'Errore sconosciuto'),
        severity: 'error'
      });
    } finally {
      setDeleteLoading(false);
      setOpenDeleteDialog(false);
      setWorkoutToDelete(null);
    }
  };

  const handleEditDateClick = (workout, event) => {
    // Previene il click del bottone di dettaglio
    event.stopPropagation();
    setWorkoutToEdit(workout);
    setOpenEditDateDialog(true);
  };
  
  const handleCloseEditDateDialog = () => {
    setOpenEditDateDialog(false);
    setWorkoutToEdit(null);
  };
  
  const handleUpdateDateSuccess = (workoutId, newDate) => {
    // Aggiorna la lista degli allenamenti con la nuova data
    setWorkouts(prevWorkouts => prevWorkouts.map(workout => {
      if (workout.id === workoutId) {
        try {
          // Prova a creare un oggetto Date valido
          const dateObj = new Date(newDate);
          // Verifica che la data sia valida prima di formattarla
          if (!isNaN(dateObj.getTime())) {
            // Manteniamo il formato originale completo per la visualizzazione
            console.log("Data aggiornata ricevuta:", newDate);
            
            // NON formattiamo qui la data in modo semplificato, 
            // manteniamo l'oggetto Date originale per permettere
            // alla visualizzazione di usare lo stesso formato delle altre date
            return { 
              ...workout, 
              date: newDate, // Manteniamo la data originale in formato ISO 
              rawDate: newDate // Salviamo anche una copia per l'ordinamento
            };
          } else {
            console.warn("Data non valida ricevuta dall'aggiornamento:", newDate);
            return workout; // Mantieni il workout originale se la data non è valida
          }
        } catch (e) {
          console.error("Errore nel processare la nuova data:", e);
          return workout; // Mantieni il workout originale in caso di errore
        }
      }
      return workout;
    }));
    
    // Mostra una notifica di successo
    setSnackbar({
      open: true,
      message: 'Data dell\'allenamento aggiornata con successo',
      severity: 'success'
    });
    
    // Riordina gli allenamenti per data in modo più sicuro
    setWorkouts(prevWorkouts => 
      [...prevWorkouts].sort((a, b) => {
        try {
          const dateA = new Date(b.rawDate || b.date);
          const dateB = new Date(a.rawDate || a.date);
          
          // Verifica che entrambe le date siano valide
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return dateA - dateB;
          } else {
            console.warn("Date non valide durante il riordinamento:", {
              a: b.rawDate || b.date,
              b: a.rawDate || a.date
            });
            return 0; // Mantieni l'ordine se una delle date non è valida
          }
        } catch (e) {
          console.error("Errore durante il riordinamento per data:", e);
          return 0; // Mantieni l'ordine in caso di errore
        }
      })
    );
  };

  // Raggruppa allenamenti per mese in modo più sicuro
  const groupWorkoutsByMonth = () => {
    const grouped = {};
    
    workouts.forEach(workout => {
      try {
        const date = new Date(workout.date);
        
        // Verifica che la data sia valida
        if (!isNaN(date.getTime())) {
          const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`; // formato MM/YYYY
          
          if (!grouped[monthYear]) {
            grouped[monthYear] = [];
          }
          
          grouped[monthYear].push(workout);
        } else {
          console.warn("Trovata data non valida in un allenamento:", workout.date);
          // Per allenamenti con date non valide, li mettiamo in una categoria "Data sconosciuta"
          if (!grouped['0/0']) {
            grouped['0/0'] = [];
          }
          grouped['0/0'].push(workout);
        }
      } catch (e) {
        console.error("Errore nell'elaborazione della data dell'allenamento:", e);
        // Per allenamenti con errori nelle date, li mettiamo in una categoria "Data sconosciuta"
        if (!grouped['0/0']) {
          grouped['0/0'] = [];
        }
        grouped['0/0'].push(workout);
      }
    });
    
    return grouped;
  };

  // Funzione per ottenere il nome del mese in italiano
  const getMonthName = (monthNum) => {
    const months = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    return months[monthNum - 1];
  };

  // Nuova funzione per gestire l'espansione/compressione dei mesi
  const toggleMonthExpansion = (monthYear) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthYear]: !prev[monthYear]
    }));
  };

  const groupedWorkouts = useMemo(() => groupWorkoutsByMonth(), [workouts]);
  
  // Ottieni il mese corrente per confronto
  const now = new Date();
  const currentMonthYear = `${now.getMonth() + 1}/${now.getFullYear()}`; // formato MM/YYYY

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box sx={{ pt: 3, pb: 6 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mb: 4,
            justifyContent: 'space-between'
          }}
        >
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

        {!isLoggedIn ? (
          <Paper elevation={2} sx={{ p: 4 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Effettua il login per visualizzare la tua cronologia allenamenti.
            </Typography>
            <MuiLink component={Link} to="/login" color="primary" sx={{ fontWeight: 'bold' }}>
              Vai alla pagina di login
            </MuiLink>
          </Paper>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
            <CircularProgress />
          </Box>
        ) : workouts.length === 0 ? (
          <Paper elevation={2} sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FitnessCenterIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6">Nessun allenamento registrato</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Non hai ancora registrato nessun allenamento. Quando registrerai i tuoi allenamenti, 
              li troverai qui, organizzati in ordine cronologico.
            </Typography>
            {activePlan && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setOpenRecordDialog(true)}
                sx={{ mt: 3 }}
              >
                Registra il tuo primo allenamento
              </Button>
            )}
          </Paper>
        ) : (
          <>
            {Object.entries(groupedWorkouts).map(([monthYear, workoutsInMonth]) => {
              const [month, year] = monthYear.split('/');
              // eslint-disable-next-line no-unused-vars
              const isCurrentMonth = monthYear === currentMonthYear;
              const isExpanded = expandedMonths[monthYear] || false;
              
              // Se il mese è "0/0" (data sconosciuta) e non è vuoto, mostra sempre
              const isUnknownDate = monthYear === '0/0' && workoutsInMonth.length > 0;
              
              return (
                <Box key={monthYear} sx={{ mb: 4 }}>
                  <Box 
                    onClick={() => toggleMonthExpansion(monthYear)}
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      mb: 2,
                      '&:hover': {
                        opacity: 0.8
                      }
                    }}
                  >
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                        pb: 1,
                        display: 'inline-block'
                      }}
                    >
                      {isUnknownDate ? 'Data sconosciuta' : `${getMonthName(parseInt(month))} ${year}`}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {!isExpanded && (
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                          {workoutsInMonth.length} allenamenti
                        </Typography>
                      )}
                      <IconButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  </Box>
                  
                  {isExpanded && (
                    <Paper elevation={2} sx={{ overflow: 'hidden' }}>
                      <List sx={{ p: 0 }}>
                        {workoutsInMonth.map((workout, index) => (
                          <ListItem 
                            key={workout.id}
                            divider={index < workoutsInMonth.length - 1}
                            secondaryAction={
                              <Box>
                                <IconButton 
                                  edge="end" 
                                  aria-label="edit workout date"
                                  onClick={(e) => handleEditDateClick(workout, e)}
                                  color="primary"
                                  sx={{ mr: 1 }}
                                >
                                  <EditCalendarIcon />
                                </IconButton>
                                <IconButton 
                                  edge="end" 
                                  aria-label="elimina"
                                  onClick={(e) => handleDeleteClick(workout, e)}
                                  color="error"
                                  sx={{ mr: 1 }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                                <IconButton 
                                  edge="end" 
                                  aria-label="dettagli"
                                  onClick={() => handleOpenWorkoutDetail(workout)}
                                  color="primary"
                                >
                                  <VisibilityIcon />
                                </IconButton>
                              </Box>
                            }
                            sx={{ py: 2 }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                                  {(() => {
                                    try {
                                      const dateObj = new Date(workout.date);
                                      // Verifica che la data sia valida
                                      if (!isNaN(dateObj.getTime())) {
                                        return dateObj.toLocaleDateString('it-IT', {
                                          weekday: 'long',
                                          day: 'numeric',
                                          month: 'long'
                                        });
                                      } else {
                                        return workout.date || 'Data sconosciuta';
                                      }
                                    } catch (e) {
                                      console.error("Errore nel formattare la data dell'allenamento:", e);
                                      return workout.date || 'Data sconosciuta';
                                    }
                                  })()}
                                </Typography>
                              }
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  {(() => {
                                    try {
                                      const dateObj = new Date(workout.date);
                                      // Verifica che la data sia valida
                                      if (!isNaN(dateObj.getTime())) {
                                        return dateObj.toLocaleTimeString('it-IT', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        });
                                      } else {
                                        return '';
                                      }
                                    } catch (e) {
                                      console.error("Errore nel formattare l'ora dell'allenamento:", e);
                                      return '';
                                    }
                                  })()} • {workout.exercises.length} esercizi
                                </Typography>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  )}
                </Box>
              );
            })}
          </>
        )}
      </Box>


      {isLoggedIn && !loading && workouts.length > 0 && (
        <Fab 
          color="secondary" 
          aria-label="add" 
          onClick={() => setOpenRecordDialog(true)}
          sx={{ 
            position: 'fixed', 
            bottom: 20, 
            right: 20,
            display: { xs: 'flex', md: 'none' }
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <WorkoutDetailDialog
        open={openDetailDialog}
        onClose={handleCloseWorkoutDetail}
        workout={selectedWorkout}
      />

      {activePlan && (
        <RecordWorkoutDialog
          open={openRecordDialog}
          onClose={handleRecordWorkout}
          activePlan={activePlan}
        />
      )}

      {/* Dialog di conferma eliminazione */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {"Conferma eliminazione"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Sei sicuro di voler eliminare questo allenamento? L'azione è irreversibile.
            {workoutToDelete && (
              <Box sx={{ mt: 2, fontWeight: 'bold' }}>
                Data: {new Date(workoutToDelete.date).toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            color="primary"
            disabled={deleteLoading}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteLoading ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog per modificare la data */}
      <EditWorkoutDateDialog 
        open={openEditDateDialog}
        onClose={handleCloseEditDateDialog}
        workout={workoutToEdit}
        onUpdateSuccess={handleUpdateDateSuccess}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default WorkoutHistory;
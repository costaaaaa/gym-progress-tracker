import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Grid, 
  Button, 
  Box, 
  Card, 
  CardContent, 
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  IconButton,
  List,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Stack,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import ExerciseDialog, { INTENSITY_TECHNIQUES } from '../components/ExerciseDialog';
import { API_BASE_URL } from '../config';

const WorkoutPlans = () => {
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openExerciseDialog, setOpenExerciseDialog] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Stati per il dialog di conferma eliminazione scheda
  const [openDeletePlanDialog, setOpenDeletePlanDialog] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [deletePlanLoading, setDeletePlanLoading] = useState(false);
  
  // Stati per il dialog di conferma eliminazione esercizio
  const [openDeleteExerciseDialog, setOpenDeleteExerciseDialog] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState(null);
  const [dayIdToDeleteFrom, setDayIdToDeleteFrom] = useState(null);
  const [deleteExerciseLoading, setDeleteExerciseLoading] = useState(false);
  
  // Nuovo stato per il dialog dei dettagli del giorno
  const [openDayDetailsDialog, setOpenDayDetailsDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Nuovi stati per la modifica degli esercizi
  const [openEditExerciseDialog, setOpenEditExerciseDialog] = useState(false);
  const [exerciseToEdit, setExerciseToEdit] = useState(null);
  const [editedExerciseValues, setEditedExerciseValues] = useState({
    sets: '',
    reps: '',
    rest: '',
    notes: '',
    intensity_technique: ''
  });
  
  const [newPlan, setNewPlan] = useState({
    name: ''
  });
  const [numDays, setNumDays] = useState(3);

  useEffect(() => {
    fetchWorkoutPlans();
  }, []);

  const fetchWorkoutPlans = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      console.log('Dati delle schede recuperati:', data);
      
      if (data.records) {
        // Ordina i piani in modo che quelli attivi appaiano per primi
        const sortedPlans = [...data.records].sort((a, b) => {
          // Se a è attivo e b non lo è, a viene prima
          if (a.is_active && !b.is_active) return -1;
          // Se b è attivo e a non lo è, b viene prima
          if (!a.is_active && b.is_active) return 1;
          // Altrimenti mantieni l'ordine originale
          return 0;
        });
        
        setWorkoutPlans(sortedPlans);
      }
    } catch (error) {
      console.error('Error fetching workout plans:', error);
      setSnackbar({
        open: true,
        message: 'Errore nel caricamento delle schede: ' + error.message,
        severity: 'error'
      });
    }
  };

  const handleAddPlan = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/create_plan.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPlan)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Errore nella creazione della scheda');
      }

      const daysToCreate = Array.from({ length: numDays }, (_, i) => ({
        name: `Giorno ${i + 1}`,
        exercises: []
      }));

      // Create workout days
      const daysResponse = await fetch(`${API_BASE_URL}api/workout/create_days.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: data.plan.id,
          days: daysToCreate
        })
      });

      const daysData = await daysResponse.json();
      if (!daysResponse.ok) {
        throw new Error(daysData.message || 'Errore nella creazione dei giorni della scheda');
      }

      setSnackbar({
        open: true,
        message: 'Scheda creata con successo',
        severity: 'success'
      });
      fetchWorkoutPlans();
      setOpenDialog(false);
      setNewPlan({
        name: ''
      });
      setNumDays(3);
    } catch (error) {
      console.error('Error creating workout plan:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Errore nella creazione della scheda',
        severity: 'error'
      });
    }
  };

  const handleActivatePlan = async (planId) => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/activate_plan.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await response.json();
      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Scheda attivata con successo',
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Errore nell\'attivazione della scheda',
        severity: 'error'
      });
    }
  };

  const handleAddExercise = async (dayIndex, exercise) => {
    try {
      // Non creiamo un nuovo esercizio, ma utilizziamo l'ID dell'esercizio esistente
      // Otteniamo l'ID dell'esercizio selezionato dall'autocomplete
      const selectedExerciseId = exercise.id;
      
      console.log('Aggiunta esercizio con ID originale:', selectedExerciseId);
      
      if (!selectedExerciseId) {
        throw new Error('ID esercizio non valido. Seleziona un esercizio esistente.');
      }

      // Aggiungiamo l'esercizio al giorno di allenamento
      const response = await fetch(`${API_BASE_URL}api/workout/add_exercise.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          day_id: workoutPlans[selectedPlanIndex].days[dayIndex].id,
          exercise_id: selectedExerciseId, // Questo è l'ID dell'esercizio dalla tabella gym_exercises
          sets: parseInt(exercise.sets),
          reps: exercise.reps,
          rest: parseInt(exercise.rest),
          notes: exercise.notes,
          intensity_technique: exercise.intensity_technique
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Esercizio aggiunto con successo',
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Errore nell\'aggiunta dell\'esercizio',
        severity: 'error'
      });
    }
  };

  const handleOpenExerciseDialog = (planIndex, dayIndex) => {
    setSelectedPlanIndex(planIndex);
    setSelectedDayIndex(dayIndex);
    setOpenExerciseDialog(true);
  };

  // Gestione apertura dialog conferma eliminazione scheda
  const handleOpenDeletePlanDialog = (plan) => {
    setPlanToDelete(plan);
    setOpenDeletePlanDialog(true);
  };
  
  // Chiusura dialog eliminazione scheda
  const handleCloseDeletePlanDialog = () => {
    setOpenDeletePlanDialog(false);
    setTimeout(() => setPlanToDelete(null), 200); // Piccolo ritardo per evitare flickering
  };
  
  // Conferma eliminazione scheda
  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return;
    
    setDeletePlanLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/delete_plan.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_id: planToDelete.id })
      });

      const data = await response.json();
      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Scheda eliminata con successo',
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Errore nell\'eliminazione della scheda',
        severity: 'error'
      });
    } finally {
      setDeletePlanLoading(false);
      setOpenDeletePlanDialog(false);
      setPlanToDelete(null);
    }
  };

  // Apertura dialog conferma eliminazione esercizio
  const handleOpenDeleteExerciseDialog = (dayId, exercise) => {
    setExerciseToDelete(exercise);
    setDayIdToDeleteFrom(dayId);
    setOpenDeleteExerciseDialog(true);
  };
  
  // Chiusura dialog eliminazione esercizio
  const handleCloseDeleteExerciseDialog = () => {
    setOpenDeleteExerciseDialog(false);
    setTimeout(() => {
      setExerciseToDelete(null);
      setDayIdToDeleteFrom(null);
    }, 200);
  };
  
  // Conferma eliminazione esercizio
  const handleConfirmDeleteExercise = async () => {
    if (!exerciseToDelete || !dayIdToDeleteFrom) return;
    
    setDeleteExerciseLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/delete_exercise.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          day_id: dayIdToDeleteFrom,
          exercise_id: exerciseToDelete.id
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Esercizio eliminato con successo',
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Errore nell\'eliminazione dell\'esercizio',
        severity: 'error'
      });
    } finally {
      setDeleteExerciseLoading(false);
      setOpenDeleteExerciseDialog(false);
      setExerciseToDelete(null);
      setDayIdToDeleteFrom(null);
    }
  };

  // Funzione per raggruppare gli esercizi per gruppo muscolare
  const groupExercisesByMuscleGroup = (exercises) => {
    if (!exercises || !Array.isArray(exercises)) return [];
    
    const groups = {};
    
    exercises.forEach(exercise => {
      const group = exercise.muscle_group.charAt(0).toUpperCase() + exercise.muscle_group.slice(1);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(exercise);
    });
    
    return Object.keys(groups).map(group => ({
      name: group,
      exercises: groups[group],
      count: groups[group].length
    }));
  };
  
  // Funzione per aprire il dialog con i dettagli del giorno
  const handleOpenDayDetails = (day) => {
    setSelectedDay(day);
    setOpenDayDetailsDialog(true);
  };
  
  // Funzione per chiudere il dialog dei dettagli
  const handleCloseDayDetails = () => {
    setOpenDayDetailsDialog(false);
    setTimeout(() => {
      setSelectedDay(null);
    }, 200);
  };

  // Nuova funzione per aprire il dialog di modifica esercizio
  const handleOpenEditExerciseDialog = (dayId, exercise) => {
    setExerciseToEdit(exercise);
    setDayIdToDeleteFrom(dayId); // Riuso lo stesso stato per identificare il giorno
    setEditedExerciseValues({
      sets: exercise.sets,
      reps: exercise.reps,
      rest: exercise.rest,
      notes: exercise.notes || '',
      intensity_technique: exercise.intensity_technique || ''
    });
    setOpenEditExerciseDialog(true);
  };
  
  // Chiusura dialog modifica esercizio
  const handleCloseEditExerciseDialog = () => {
    setOpenEditExerciseDialog(false);
    setTimeout(() => {
      setExerciseToEdit(null);
      setDayIdToDeleteFrom(null);
      setEditedExerciseValues({
        sets: '',
        reps: '',
        rest: '',
        notes: '',
        intensity_technique: ''
      });
    }, 200);
  };
  
  // Gestione cambiamenti nei campi del form di modifica
  const handleEditExerciseChange = (e) => {
    const { name, value } = e.target;
    setEditedExerciseValues(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Conferma modifica esercizio
  const handleConfirmEditExercise = async () => {
    if (!exerciseToEdit || !dayIdToDeleteFrom) return;
    
    try {
      // Prepara i dati da inviare, con controlli di tipo
      const exerciseData = {
        day_id: dayIdToDeleteFrom,
        exercise_id: exerciseToEdit.id,
        sets: parseInt(editedExerciseValues.sets) || 0,
        reps: editedExerciseValues.reps || '',
        rest: parseInt(editedExerciseValues.rest) || 0,
        notes: editedExerciseValues.notes || '',
        intensity_technique: editedExerciseValues.intensity_technique || ''
      };
      
      // Log dei dati che stiamo per inviare per debugging
      console.log('Invio richiesta di modifica esercizio con i seguenti dati:', exerciseData);
      
      // Notifica l'utente che stiamo salvando le modifiche
      setSnackbar({
        open: true,
        message: 'Salvataggio modifiche in corso...',
        severity: 'info'
      });
      
      const response = await fetch(`${API_BASE_URL}api/workout/update_exercise.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exerciseData),
        credentials: 'include' // Assicura che i cookie di sessione vengano inviati
      });

      // Ottieni i dati di risposta e loggali
      const data = await response.json();
      console.log('Risposta dalla modifica esercizio:', data);
      
      if (response.ok) {
        // Chiudiamo il dialog
        handleCloseEditExerciseDialog();
        
        console.log('Esercizio aggiornato con successo, recupero i dati aggiornati...');
        
        // Recupera i piani aggiornati
        const updatedPlansResponse = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
          method: 'GET',
          credentials: 'include'
        });
        
        const updatedPlansData = await updatedPlansResponse.json();
        console.log('Dati delle schede recuperati dopo la modifica:', updatedPlansData);
        
        // Verifica che i dati recuperati contengano la modifica effettuata
        let modificaVerificata = false;
        
        if (updatedPlansData.records) {
          // Cerca l'esercizio modificato nei dati aggiornati
          updatedPlansData.records.forEach(plan => {
            if (plan.days) {
              plan.days.forEach(day => {
                if (day.id === dayIdToDeleteFrom && day.exercises) {
                  day.exercises.forEach(ex => {
                    if (ex.id === exerciseToEdit.id) {
                      console.log('Esercizio trovato nei dati aggiornati:', ex);
                      console.log('Confronto valori - sets:', ex.sets, 'vs', exerciseData.sets);
                      console.log('Confronto valori - reps:', ex.reps, 'vs', exerciseData.reps);
                      console.log('Confronto valori - rest:', ex.rest, 'vs', exerciseData.rest);
                      
                      // Verifica se i valori sono stati aggiornati correttamente
                      if (ex.sets === exerciseData.sets && 
                          ex.reps === exerciseData.reps && 
                          ex.rest === exerciseData.rest &&
                          (ex.notes || '') === (exerciseData.notes || '')) {
                        modificaVerificata = true;
                      }
                      
                      // Log per debugging delle note
                      console.log('Confronto valori - notes:', ex.notes, 'vs', exerciseData.notes);
                    }
                  });
                }
              });
            }
          });
          
          // Se la verifica è andata a buon fine, aggiorna i dati locali
          if (modificaVerificata) {
            console.log('La modifica è stata verificata nei dati recuperati, aggiorno lo stato locale');
            
            // Ordina i piani in modo che quelli attivi appaiano per primi
            const sortedPlans = [...updatedPlansData.records].sort((a, b) => {
              if (a.is_active && !b.is_active) return -1;
              if (!a.is_active && b.is_active) return 1;
              return 0;
            });
            
            // Aggiorna i piani localmente
            setWorkoutPlans(sortedPlans);
            
            // Mostra il messaggio di successo
            setSnackbar({
              open: true,
              message: 'Esercizio aggiornato con successo',
              severity: 'success'
            });
          } else {
            console.error('ERRORE: La modifica non è stata trovata nei dati recuperati!');
            
            // Riprova il recupero dopo un timeout più lungo
            setTimeout(async () => {
              console.log('Nuovo tentativo di recupero dati dopo timeout...');
              await fetchWorkoutPlans();
              
              setSnackbar({
                open: true,
                message: 'Modifiche salvate, ricarica la pagina se non vedi i cambiamenti',
                severity: 'warning'
              });
            }, 2000);
          }
        } else {
          console.error('ERRORE: Nessun dato ricevuto nella risposta di recupero piani!');
          throw new Error('Errore nel recupero dei dati aggiornati');
        }
      } else {
        throw new Error(data.message || 'Errore nella modifica dell\'esercizio');
      }
    } catch (error) {
      console.error('Errore nella modifica dell\'esercizio:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Errore nella modifica dell\'esercizio',
        severity: 'error'
      });
      handleCloseEditExerciseDialog();
    }
  };
  
  // Funzione per spostare un esercizio su nella lista
  const handleMoveExerciseUp = async (dayId, exercise, currentIndex) => {
    if (currentIndex <= 0) return; // Non può essere spostato più in alto
    
    try {
      console.log(`Tentativo di spostare l'esercizio ${exercise.id} (${exercise.exercise_name}) su`, {
        dayId,
        exercise,
        currentIndex
      });
      
      const response = await fetch(`${API_BASE_URL}api/workout/reorder_exercise.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          day_id: dayId,
          exercise_id: exercise.id,
          direction: 'up'
        }),
        credentials: 'include'
      });

      const data = await response.json();
      console.log('Risposta dal server (moveUp):', data);
      
      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Ordine degli esercizi aggiornato',
          severity: 'success'
        });
        // Aggiungiamo un timeout per dare tempo al database di aggiornare i dati
        setTimeout(() => {
          fetchWorkoutPlans();
        }, 300);
      } else {
        throw new Error(data.message || 'Errore nel server');
      }
    } catch (error) {
      console.error('Errore nel riordinamento (su):', error);
      setSnackbar({
        open: true,
        message: error.message || 'Errore nello spostamento dell\'esercizio',
        severity: 'error'
      });
    }
  };
  
  // Funzione per spostare un esercizio giù nella lista
  const handleMoveExerciseDown = async (dayId, exercise, currentIndex, totalExercises) => {
    if (currentIndex >= totalExercises - 1) return; // Non può essere spostato più in basso
    
    try {
      console.log(`Tentativo di spostare l'esercizio ${exercise.id} (${exercise.exercise_name}) giù`, {
        dayId,
        exercise,
        currentIndex,
        totalExercises
      });
      
      const response = await fetch(`${API_BASE_URL}api/workout/reorder_exercise.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          day_id: dayId,
          exercise_id: exercise.id,
          direction: 'down'
        }),
        credentials: 'include'
      });

      const data = await response.json();
      console.log('Risposta dal server (moveDown):', data);
      
      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Ordine degli esercizi aggiornato',
          severity: 'success'
        });
        // Aggiungiamo un timeout per dare tempo al database di aggiornare i dati
        setTimeout(() => {
          fetchWorkoutPlans();
        }, 300);
      } else {
        throw new Error(data.message || 'Errore nel server');
      }
    } catch (error) {
      console.error('Errore nel riordinamento (giù):', error);
      setSnackbar({
        open: true,
        message: error.message || 'Errore nello spostamento dell\'esercizio',
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Le Mie Schede
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon sx={{ color: "white" }} />}
        onClick={() => setOpenDialog(true)}
        sx={{ mb: 3 }}
      >
        Nuova Scheda
      </Button>

      <Grid container spacing={3}>
        {workoutPlans.map((plan, planIndex) => (
          <Grid item xs={12} md={6} key={plan.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">{plan.name}</Typography>
                  <IconButton 
                    onClick={() => handleOpenDeletePlanDialog(plan)}
                    color="error"
                    aria-label="delete plan"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                {plan.days && plan.days.map((day, dayIndex) => (
                  <Box key={day.id} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {day.name}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<InfoIcon />}
                        onClick={() => handleOpenDayDetails(day)}
                      >
                        Dettagli
                      </Button>
                    </Box>
                    
                    {/* Vista compatta dei gruppi muscolari */}
                    <Box sx={{ mb: 2 }}>
                      {day.exercises && day.exercises.length > 0 ? (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {groupExercisesByMuscleGroup(day.exercises).map((group, idx) => (
                            <Chip 
                              key={idx}
                              icon={<FitnessCenterIcon />}
                              label={`${group.name} (${group.count})`} 
                              color="primary"
                              variant="outlined"
                              onClick={() => handleOpenDayDetails(day)}
                              sx={{ m: 0.5 }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Nessun esercizio aggiunto
                        </Typography>
                      )}
                    </Box>
                    
                    <Button
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenExerciseDialog(planIndex, dayIndex)}
                      size="small"
                    >
                      Aggiungi Esercizio
                    </Button>
                  </Box>
                ))}
              </CardContent>
              <CardActions>
                <Button
                  variant={plan.is_active ? "contained" : "outlined"}
                  onClick={() => handleActivatePlan(plan.id)}
                  fullWidth
                >
                  {plan.is_active ? "Scheda Attiva" : "Attiva Scheda"}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Dialog Dettagli Giorno */}
      <Dialog
        open={openDayDetailsDialog}
        onClose={handleCloseDayDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedDay?.name || 'Dettagli Giorno'}
            </Typography>
            <IconButton onClick={handleCloseDayDetails}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDay?.exercises && selectedDay.exercises.length > 0 ? (
            <List>
              {groupExercisesByMuscleGroup(selectedDay.exercises).map((group, groupIdx) => (
                <React.Fragment key={groupIdx}>
                  <Box sx={{ mb: 2, mt: groupIdx > 0 ? 2 : 0 }}>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                      <FitnessCenterIcon sx={{ mr: 1 }} /> {group.name}
                    </Typography>
                    <Divider sx={{ mt: 1, mb: 2 }} />
                    
                    {group.exercises.map((exercise, exerciseIdx) => {
                      // Determiniamo l'indice globale dell'esercizio all'interno del giorno
                      const exerciseGlobalIndex = selectedDay.exercises.findIndex(e => e.id === exercise.id);
                      return (
                        <Box key={exercise.id} sx={{ mb: 2, pl: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {exercise.exercise_name}
                              </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {exercise.sets} serie x {exercise.reps} - Recupero: {exercise.rest}s
                                </Typography>
                                {exercise.intensity_technique && (
                                  <Chip 
                                    icon={<WhatshotIcon />}
                                    label={exercise.intensity_technique} 
                                    size="small" 
                                    color="secondary" 
                                    sx={{ mt: 1, mb: 0.5 }} 
                                  />
                                )}
                                {exercise.notes && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                  Note: {exercise.notes}
                                </Typography>
                              )}
                            </div>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {/* Pulsanti per riordinare */}
                              <ButtonGroup size="small" sx={{ mr: 1 }}>
                                <IconButton 
                                  size="small"
                                  disabled={exerciseGlobalIndex <= 0}
                                  onClick={() => {
                                    console.log("Clic su Move Up", {
                                      dayId: selectedDay.id,
                                      exerciseId: exercise.id,
                                      exerciseName: exercise.exercise_name,
                                      index: exerciseGlobalIndex
                                    });
                                    handleMoveExerciseUp(
                                      selectedDay.id, 
                                      exercise, 
                                      exerciseGlobalIndex
                                    );
                                  }}
                                >
                                  <ArrowUpwardIcon fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  size="small"
                                  disabled={exerciseGlobalIndex >= selectedDay.exercises.length - 1}
                                  onClick={() => {
                                    console.log("Clic su Move Down", {
                                      dayId: selectedDay.id,
                                      exerciseId: exercise.id,
                                      exerciseName: exercise.exercise_name,
                                      index: exerciseGlobalIndex,
                                      total: selectedDay.exercises.length
                                    });
                                    handleMoveExerciseDown(
                                      selectedDay.id, 
                                      exercise, 
                                      exerciseGlobalIndex, 
                                      selectedDay.exercises.length
                                    );
                                  }}
                                >
                                  <ArrowDownwardIcon fontSize="small" />
                                </IconButton>
                              </ButtonGroup>
                              
                              {/* Pulsante per modificare */}
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenEditExerciseDialog(selectedDay.id, exercise)}
                                sx={{ mr: 1 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              
                              {/* Pulsante per eliminare */}
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  handleCloseDayDetails();
                                  setTimeout(() => {
                                    handleOpenDeleteExerciseDialog(selectedDay.id, exercise);
                                  }, 300);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography variant="body1" align="center" sx={{ py: 2 }}>
              Nessun esercizio aggiunto a questo giorno.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={() => {
              const planIndex = workoutPlans.findIndex(p => 
                p.days && p.days.some(d => d.id === selectedDay?.id)
              );
              const dayIndex = planIndex >= 0 ? 
                workoutPlans[planIndex].days.findIndex(d => d.id === selectedDay?.id) : -1;
              
              if (planIndex >= 0 && dayIndex >= 0) {
                handleCloseDayDetails();
                setTimeout(() => {
                  handleOpenExerciseDialog(planIndex, dayIndex);
                }, 300);
              }
            }}
          >
            Aggiungi Esercizio
          </Button>
          <Button onClick={handleCloseDayDetails}>Chiudi</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuova Scheda</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nome Scheda"
            type="text"
            fullWidth
            value={newPlan.name}
            onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
            sx={{ mb: 3 }}
          />
          <FormControl fullWidth>
            <InputLabel id="num-days-label">Numero di Giorni</InputLabel>
            <Select
              labelId="num-days-label"
              value={numDays}
              label="Numero di Giorni"
              onChange={(e) => setNumDays(parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <MenuItem key={num} value={num}>
                  {num} Giorn{num === 1 ? 'o' : 'i'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Annulla</Button>
          <Button onClick={handleAddPlan} variant="contained" disabled={!newPlan.name}>
            Crea
          </Button>
        </DialogActions>
      </Dialog>

      <ExerciseDialog
        open={openExerciseDialog}
        onClose={() => setOpenExerciseDialog(false)}
        onAdd={handleAddExercise}
        dayIndex={selectedDayIndex}
      />

      <Dialog
        open={openDeletePlanDialog}
        onClose={handleCloseDeletePlanDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Conferma eliminazione scheda"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Sei sicuro di voler eliminare questa scheda? L'azione è irreversibile.
            {planToDelete && (
              <Box sx={{ mt: 2, fontWeight: 'bold' }}>
                Scheda: {planToDelete.name}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeletePlanDialog} 
            color="primary"
            disabled={deletePlanLoading}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleConfirmDeletePlan} 
            color="error" 
            variant="contained"
            disabled={deletePlanLoading}
            startIcon={deletePlanLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deletePlanLoading ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteExerciseDialog}
        onClose={handleCloseDeleteExerciseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Conferma eliminazione esercizio"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Sei sicuro di voler eliminare questo esercizio? L'azione è irreversibile.
            {exerciseToDelete && (
              <Box sx={{ mt: 2, fontWeight: 'bold' }}>
                Esercizio: {exerciseToDelete.name}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteExerciseDialog} 
            color="primary"
            disabled={deleteExerciseLoading}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleConfirmDeleteExercise} 
            color="error" 
            variant="contained"
            disabled={deleteExerciseLoading}
            startIcon={deleteExerciseLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteExerciseLoading ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog per la modifica dell'esercizio */}
      <Dialog
        open={openEditExerciseDialog}
        onClose={handleCloseEditExerciseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Modifica Esercizio</DialogTitle>
        <DialogContent>
          {exerciseToEdit && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="h6">{exerciseToEdit.exercise_name}</Typography>
              <Typography variant="body2" color="text.secondary">{exerciseToEdit.muscle_group}</Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  name="sets"
                  label="Serie"
                  type="number"
                  value={editedExerciseValues.sets}
                  onChange={handleEditExerciseChange}
                  fullWidth
                  InputProps={{ inputProps: { min: 1 } }}
                />
                <TextField
                  name="reps"
                  label="Ripetizioni"
                  value={editedExerciseValues.reps}
                  onChange={handleEditExerciseChange}
                  fullWidth
                />
              </Box>
              <TextField
                name="rest"
                label="Recupero (secondi)"
                type="number"
                value={editedExerciseValues.rest}
                onChange={handleEditExerciseChange}
                fullWidth
                InputProps={{ inputProps: { min: 0 } }}
              />
              
              <FormControl fullWidth>
                <InputLabel>Tecnica di Intensità (Opzionale)</InputLabel>
                <Select
                  name="intensity_technique"
                  value={editedExerciseValues.intensity_technique}
                  label="Tecnica di Intensità (Opzionale)"
                  onChange={handleEditExerciseChange}
                >
                  {INTENSITY_TECHNIQUES.map((tech) => (
                    <MenuItem key={tech} value={tech === 'Nessuna (Normale)' ? '' : tech}>
                      {tech}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                name="notes"
                label="Note"
                value={editedExerciseValues.notes}
                onChange={handleEditExerciseChange}
                fullWidth
                multiline
                rows={3}
                placeholder="Inserisci eventuali note sull'esercizio"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditExerciseDialog}>Annulla</Button>
          <Button 
            onClick={handleConfirmEditExercise} 
            variant="contained"
            disabled={!editedExerciseValues.sets || !editedExerciseValues.reps || !editedExerciseValues.rest}
          >
            Salva Modifiche
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
};

export default WorkoutPlans;
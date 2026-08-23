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
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  ButtonGroup,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import ExerciseDialog, { INTENSITY_TECHNIQUES } from '../components/ExerciseDialog';
import { API_BASE_URL } from '../config';

const WorkoutPlans = ({ isEmbedded = false }) => {
  const [workoutPlans, setWorkoutPlans] = useState([]);
  const [expandedPlans, setExpandedPlans] = useState({});
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
  
  // Stato per l'espansione inline dei dettagli del giorno (ex dialog)
  const [expandedDays, setExpandedDays] = useState({});
  
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
    name: '',
    description: ''
  });
  const [numDays, setNumDays] = useState(3);
  
  // Stati per la modifica della scheda
  const [openEditPlanDialog, setOpenEditPlanDialog] = useState(false);
  const [planToEdit, setPlanToEdit] = useState(null);
  const [editedPlanValues, setEditedPlanValues] = useState({
    name: '',
    description: ''
  });
  const [updatePlanLoading, setUpdatePlanLoading] = useState(false);

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

  const togglePlanExpansion = (planId) => {
    setExpandedPlans(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }));
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
        name: '',
        description: ''
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

  const handleEditPlan = async () => {
    if (!editedPlanValues.name.trim() || !planToEdit) return;

    setUpdatePlanLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/workout/update_plan.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planToEdit.id,
          name: editedPlanValues.name,
          description: editedPlanValues.description,
          is_active: planToEdit.is_active
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Errore nell\'aggiornamento della scheda');
      }

      setSnackbar({
        open: true,
        message: 'Scheda aggiornata con successo',
        severity: 'success'
      });
      fetchWorkoutPlans();
      handleCloseEditPlanDialog();
    } catch (error) {
      console.error('Error updating workout plan:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Errore nell\'aggiornamento della scheda',
        severity: 'error'
      });
    } finally {
      setUpdatePlanLoading(false);
    }
  };

  const handleCloseEditPlanDialog = () => {
    setOpenEditPlanDialog(false);
    setTimeout(() => {
      setPlanToEdit(null);
      setEditedPlanValues({
        name: '',
        description: ''
      });
    }, 200);
  };

  const handleOpenEditPlanDialog = (plan) => {
    setPlanToEdit(plan);
    setEditedPlanValues({
      name: plan.name,
      description: plan.description || ''
    });
    setOpenEditPlanDialog(true);
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
  
  // Espande/collassa i dettagli inline di un giorno (esercizi, riordino, modifica, eliminazione)
  const toggleDayExpansion = (dayId) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayId]: !prev[dayId]
    }));
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
    <Box sx={{ p: isEmbedded ? 0 : 3 }}>
      {!isEmbedded && (
        <Typography variant="h4" gutterBottom>
          Le Mie Schede
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 20 }}>
          Le tue Schede
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ color: "white" }} fontSize="small" />}
          onClick={() => setOpenDialog(true)}
          sx={{ fontSize: 13, fontWeight: 600 }}
        >
          Nuova Scheda
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {workoutPlans.map((plan, planIndex) => {
          const isExpanded = expandedPlans[plan.id];
          const totalDays = plan.days?.length || 0;
          const totalExercises = plan.days?.reduce((acc, day) => acc + (day.exercises?.length || 0), 0) || 0;

          return (
            <Grid item xs={12} md={6} key={plan.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ p: 3, flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 16 }}>
                          {plan.name}
                        </Typography>
                        {!!plan.is_active && (
                          <Box
                            component="span"
                            sx={{
                              bgcolor: (theme) => theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)',
                              color: 'primary.main',
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.03em',
                              px: 1.25,
                              py: 0.5,
                              borderRadius: '999px',
                            }}
                          >
                            ATTIVA
                          </Box>
                        )}
                      </Box>
                      {plan.description && (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.5 }}>
                          {plan.description}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <IconButton
                        onClick={() => handleOpenEditPlanDialog(plan)}
                        size="small"
                        sx={{ color: 'text.secondary' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        onClick={() => handleOpenDeletePlanDialog(plan)}
                        size="small"
                        sx={{ color: 'text.secondary' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {isExpanded ? (
                    <Box sx={{ mt: 2.25, pt: 2.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {plan.days && plan.days.map((day, dayIndex) => {
                        const dayExpanded = !!expandedDays[day.id];
                        const dayPanelId = `day-details-panel-${day.id}`;
                        return (
                          <Box key={day.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {day.name}
                              </Typography>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => toggleDayExpansion(day.id)}
                                aria-expanded={dayExpanded}
                                aria-controls={dayPanelId}
                                sx={{ fontSize: 12, fontWeight: 600, textTransform: 'none', minWidth: 0, p: 0 }}
                              >
                                {dayExpanded ? 'Nascondi' : 'Dettagli'}
                              </Button>
                            </Box>

                            <Box sx={{ mb: 1 }}>
                              {day.exercises && day.exercises.length > 0 ? (
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  {groupExercisesByMuscleGroup(day.exercises).map((group, idx) => (
                                    <Box
                                      key={idx}
                                      sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: '8px',
                                        px: 1.5,
                                        py: 0.75,
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {group.name} ({group.count})
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Nessun esercizio aggiunto
                                </Typography>
                              )}
                            </Box>

                            <Collapse in={dayExpanded} id={dayPanelId} timeout="auto">
                              <Box sx={{
                                mt: 1.25, mb: 1.5, borderRadius: '10px', p: '12px 14px',
                                bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf9f8' : 'action.hover',
                              }}>
                                {day.exercises && day.exercises.length > 0 ? (
                                  groupExercisesByMuscleGroup(day.exercises).map((group, groupIdx) => (
                                    <Box key={groupIdx} sx={{ mb: 2, mt: groupIdx > 0 ? 2 : 0, '&:last-of-type': { mb: 0 } }}>
                                      <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                                        <FitnessCenterIcon fontSize="small" sx={{ mr: 1 }} /> {group.name}
                                      </Typography>
                                      <Divider sx={{ mt: 1, mb: 1.5 }} />
                                      {group.exercises.map((exercise) => {
                                        const exerciseGlobalIndex = day.exercises.findIndex(e => e.id === exercise.id);
                                        return (
                                          <Box key={exercise.id} sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                              <div>
                                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
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
                                              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                                <ButtonGroup size="small" sx={{ mr: 1 }}>
                                                  <IconButton
                                                    size="small"
                                                    disabled={exerciseGlobalIndex <= 0}
                                                    onClick={() => handleMoveExerciseUp(day.id, exercise, exerciseGlobalIndex)}
                                                  >
                                                    <ArrowUpwardIcon fontSize="small" />
                                                  </IconButton>
                                                  <IconButton
                                                    size="small"
                                                    disabled={exerciseGlobalIndex >= day.exercises.length - 1}
                                                    onClick={() => handleMoveExerciseDown(day.id, exercise, exerciseGlobalIndex, day.exercises.length)}
                                                  >
                                                    <ArrowDownwardIcon fontSize="small" />
                                                  </IconButton>
                                                </ButtonGroup>
                                                <IconButton
                                                  size="small"
                                                  color="primary"
                                                  onClick={() => handleOpenEditExerciseDialog(day.id, exercise)}
                                                  sx={{ mr: 1 }}
                                                >
                                                  <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                  size="small"
                                                  color="error"
                                                  onClick={() => handleOpenDeleteExerciseDialog(day.id, exercise)}
                                                >
                                                  <DeleteIcon fontSize="small" />
                                                </IconButton>
                                              </Box>
                                            </Box>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  ))
                                ) : (
                                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 1 }}>
                                    Nessun esercizio aggiunto a questo giorno.
                                  </Typography>
                                )}
                              </Box>
                            </Collapse>

                            <Button
                              startIcon={<AddIcon fontSize="small" />}
                              onClick={() => handleOpenExerciseDialog(planIndex, dayIndex)}
                              size="small"
                              sx={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}
                            >
                              Aggiungi Esercizio
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography sx={{ mt: 1.75, fontSize: 13, color: 'text.secondary' }}>
                      {totalDays} giorni · {totalExercises} esercizi
                    </Typography>
                  )}
                </CardContent>
                <CardActions sx={{ px: 3, pb: 2.5, pt: 2, mt: 'auto', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => togglePlanExpansion(plan.id)}
                    aria-expanded={isExpanded}
                    sx={{ fontSize: 12, fontWeight: 600, textTransform: 'none', color: 'text.secondary', minWidth: 0, p: 0 }}
                  >
                    {isExpanded ? "Nascondi dettagli" : "Mostra dettagli"}
                  </Button>

                  {!plan.is_active && (
                    <Button
                      size="small"
                      onClick={() => handleActivatePlan(plan.id)}
                      sx={{
                        bgcolor: 'text.primary',
                        color: (theme) => theme.palette.getContrastText(theme.palette.text.primary),
                        borderRadius: '8px', px: 2, py: 1, fontSize: 12, fontWeight: 600, textTransform: 'none',
                        '&:hover': { bgcolor: 'text.primary', opacity: 0.85 },
                      }}
                    >
                      Attiva Scheda
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuova Scheda</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label="Nome Scheda"
              type="text"
              fullWidth
              placeholder="Es. Forza 5x5"
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
            />
            <TextField
              label="Descrizione (Opzionale)"
              type="text"
              fullWidth
              multiline
              rows={2}
              placeholder="Breve descrizione dell'obiettivo della scheda"
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Annulla</Button>
          <Button onClick={handleAddPlan} variant="contained" disabled={!newPlan.name}>
            Crea
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Modifica Scheda */}
      <Dialog open={openEditPlanDialog} onClose={handleCloseEditPlanDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Modifica Scheda</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label="Nome Scheda"
              type="text"
              fullWidth
              value={editedPlanValues.name}
              onChange={(e) => setEditedPlanValues({ ...editedPlanValues, name: e.target.value })}
            />
            <TextField
              label="Descrizione (Opzionale)"
              type="text"
              fullWidth
              multiline
              rows={2}
              value={editedPlanValues.description}
              onChange={(e) => setEditedPlanValues({ ...editedPlanValues, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditPlanDialog} disabled={updatePlanLoading}>Annulla</Button>
          <Button 
            onClick={handleEditPlan} 
            variant="contained" 
            disabled={!editedPlanValues.name || updatePlanLoading}
            startIcon={updatePlanLoading ? <CircularProgress size={20} /> : null}
          >
            {updatePlanLoading ? 'Salvataggio...' : 'Salva'}
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

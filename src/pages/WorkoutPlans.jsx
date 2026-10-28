import { useState, useEffect, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import { muscleLabel, techniqueLabel } from '../i18n/labels';
import { TITLE_FONT_FAMILY } from '../utils/fonts';

const WorkoutPlans = ({ isEmbedded = false }) => {
  const { t } = useTranslation();
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
  const [goalAfterDelete, setGoalAfterDelete] = useState(null); // obiettivo a cui tornerebbe la settimana eliminando la scheda attiva, null = non cambia
  const goalRequest = useRef(0); // distingue la richiesta dell'obiettivo del dialog aperto da quelle di dialog già chiusi
  
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        message: t('plans.msg.load_error', { message: error.message }),
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
        throw new Error(data.message || t('plans.msg.create_error'));
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
        throw new Error(daysData.message || t('plans.msg.create_days_error'));
      }

      setSnackbar({
        open: true,
        message: t('plans.msg.created'),
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
        message: error.message || t('plans.msg.create_error'),
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
        throw new Error(data.message || t('plans.msg.update_error'));
      }

      setSnackbar({
        open: true,
        message: t('plans.msg.updated'),
        severity: 'success'
      });
      fetchWorkoutPlans();
      handleCloseEditPlanDialog();
    } catch (error) {
      console.error('Error updating workout plan:', error);
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.update_error'),
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
          message: t('plans.msg.activated'),
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.activate_error'),
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
        throw new Error(t('plans.msg.invalid_exercise_id'));
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
          message: t('plans.msg.exercise_added'),
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.add_exercise_error'),
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
    setGoalAfterDelete(null);
    const request = ++goalRequest.current;
    setOpenDeletePlanDialog(true);
    if (!plan.is_active) return;
    // Senza scheda attiva, e senza un obiettivo scelto dall'utente, l'obiettivo della settimana torna a quello senza scheda
    fetch(`${API_BASE_URL}api/user/read.php`, { credentials: 'include' })
      .then(response => (response.ok ? response.json() : null))
      .then(user => {
        if (request !== goalRequest.current) return;
        if (user && user.weekly_goal == null && user.weekly_goal_default !== user.weekly_goal_without_plan) setGoalAfterDelete(user.weekly_goal_without_plan);
      })
      .catch(() => {});
  };
  
  // Chiusura dialog eliminazione scheda
  const handleCloseDeletePlanDialog = () => {
    goalRequest.current += 1;
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
          message: t('plans.msg.plan_deleted'),
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.delete_plan_error'),
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
          message: t('plans.msg.exercise_deleted'),
          severity: 'success'
        });
        fetchWorkoutPlans();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.delete_exercise_error'),
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
      
      // Notifica l'utente che stiamo salvando le modifiche
      setSnackbar({
        open: true,
        message: t('plans.msg.saving_changes'),
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

      const data = await response.json();

      if (response.ok) {
        // Chiudiamo il dialog
        handleCloseEditExerciseDialog();

        // Recupera i piani aggiornati
        const updatedPlansResponse = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
          method: 'GET',
          credentials: 'include'
        });
        
        const updatedPlansData = await updatedPlansResponse.json();

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
                      // Verifica se i valori sono stati aggiornati correttamente
                      if (ex.sets === exerciseData.sets &&
                          ex.reps === exerciseData.reps &&
                          ex.rest === exerciseData.rest &&
                          (ex.notes || '') === (exerciseData.notes || '')) {
                        modificaVerificata = true;
                      }
                    }
                  });
                }
              });
            }
          });
          
          // Se la verifica è andata a buon fine, aggiorna i dati locali
          if (modificaVerificata) {
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
              message: t('plans.msg.exercise_updated'),
              severity: 'success'
            });
          } else {
            console.error('ERRORE: La modifica non è stata trovata nei dati recuperati!');
            
            // Riprova il recupero dopo un timeout più lungo
            setTimeout(async () => {
              await fetchWorkoutPlans();
              
              setSnackbar({
                open: true,
                message: t('plans.msg.saved_reload'),
                severity: 'warning'
              });
            }, 2000);
          }
        } else {
          console.error('ERRORE: Nessun dato ricevuto nella risposta di recupero piani!');
          throw new Error(t('plans.msg.refetch_error'));
        }
      } else {
        throw new Error(data.message || t('plans.msg.edit_exercise_error'));
      }
    } catch (error) {
      console.error('Errore nella modifica dell\'esercizio:', error);
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.edit_exercise_error'),
        severity: 'error'
      });
      handleCloseEditExerciseDialog();
    }
  };
  
  // Funzione per spostare un esercizio su nella lista
  const handleMoveExerciseUp = async (dayId, exercise, currentIndex) => {
    if (currentIndex <= 0) return; // Non può essere spostato più in alto
    
    try {
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

      if (response.ok) {
        setSnackbar({
          open: true,
          message: t('plans.msg.order_updated'),
          severity: 'success'
        });
        // Aggiungiamo un timeout per dare tempo al database di aggiornare i dati
        setTimeout(() => {
          fetchWorkoutPlans();
        }, 300);
      } else {
        throw new Error(data.message || t('plans.msg.server_error'));
      }
    } catch (error) {
      console.error('Errore nel riordinamento (su):', error);
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.move_error'),
        severity: 'error'
      });
    }
  };
  
  // Funzione per spostare un esercizio giù nella lista
  const handleMoveExerciseDown = async (dayId, exercise, currentIndex, totalExercises) => {
    if (currentIndex >= totalExercises - 1) return; // Non può essere spostato più in basso
    
    try {
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

      if (response.ok) {
        setSnackbar({
          open: true,
          message: t('plans.msg.order_updated'),
          severity: 'success'
        });
        // Aggiungiamo un timeout per dare tempo al database di aggiornare i dati
        setTimeout(() => {
          fetchWorkoutPlans();
        }, 300);
      } else {
        throw new Error(data.message || t('plans.msg.server_error'));
      }
    } catch (error) {
      console.error('Errore nel riordinamento (giù):', error);
      setSnackbar({
        open: true,
        message: error.message || t('plans.msg.move_error'),
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ p: isEmbedded ? 0 : 3 }}>
      {!isEmbedded && (
        <Typography variant="pageTitle" gutterBottom>
          {t('plans.page_title')}
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', mb: 3 }}>
        {!isEmbedded && (
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20 }}>
            {t('plans.section_title')}
          </Typography>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ color: "white" }} fontSize="small" />}
          onClick={() => setOpenDialog(true)}
          sx={{ fontSize: 16, fontWeight: 600 }}
        >
          {t('plans.new')}
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
                        <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16 }}>
                          {plan.name}
                        </Typography>
                        {!!plan.is_active && (
                          <Box
                            component="span"
                            sx={{
                              bgcolor: (theme) => theme.palette.mode === 'light' ? '#e8f3ec' : 'rgba(34, 197, 94, 0.15)',
                              color: (theme) => theme.palette.mode === 'light' ? '#166534' : '#86efac',
                              fontSize: 13,
                              fontWeight: 700,
                              px: 1.25,
                              py: 0.5,
                              borderRadius: '999px',
                            }}
                          >
                            {t('plans.active_badge')}
                          </Box>
                        )}
                      </Box>
                      {plan.description && (
                        <Typography sx={{ fontSize: 16, color: 'text.secondary', lineHeight: 1.5 }}>
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
                                {dayExpanded ? t('plans.hide') : t('plans.details')}
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
                                      {muscleLabel(group.name)} ({group.count})
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  {t('plans.no_exercises')}
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
                                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', color: 'text.primary' }}>
                                        <FitnessCenterIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> {muscleLabel(group.name)}
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
                                                  {t('plans.sets_line', { sets: exercise.sets, reps: exercise.reps, rest: exercise.rest })}
                                                </Typography>
                                                {exercise.intensity_technique && (
                                                  <Chip
                                                    icon={<WhatshotIcon />}
                                                    label={techniqueLabel(exercise.intensity_technique)}
                                                    size="small"
                                                    color="secondary"
                                                    sx={{ mt: 1, mb: 0.5 }}
                                                  />
                                                )}
                                                {exercise.notes && (
                                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                                    {t('plans.notes', { notes: exercise.notes })}
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
                                                  aria-label={t('plans.edit_exercise.aria')}
                                                  onClick={() => handleOpenEditExerciseDialog(day.id, exercise)}
                                                  sx={{ mr: 1, color: 'text.secondary' }}
                                                >
                                                  <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                  size="small"
                                                  aria-label={t('plans.delete_exercise.aria')}
                                                  onClick={() => handleOpenDeleteExerciseDialog(day.id, exercise)}
                                                  sx={{ color: 'text.secondary' }}
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
                                    {t('plans.no_exercises_day')}
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
                              {t('plans.add_exercise')}
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>
                      {t('plans.days_count', { count: totalDays })} · {t('plans.exercises_count', { count: totalExercises })}
                    </Typography>
                  )}
                </CardContent>
                <CardActions sx={{ px: 3, pb: 2.5, pt: 2, mt: 'auto', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => togglePlanExpansion(plan.id)}
                    aria-expanded={isExpanded}
                    sx={{ fontSize: 16, fontWeight: 600, textTransform: 'none', color: 'text.secondary', minWidth: 0, p: 0 }}
                  >
                    {isExpanded ? t('plans.hide_details') : t('plans.show_details')}
                  </Button>

                  {!plan.is_active && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleActivatePlan(plan.id)}
                      sx={{
                        color: 'text.primary', borderColor: 'text.secondary',
                        borderRadius: '8px', px: 2, py: 1, fontSize: 16, fontWeight: 600, textTransform: 'none',
                        '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' },
                      }}
                    >
                      {t('plans.activate')}
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('plans.new')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label={t('plans.new_dialog.name')}
              type="text"
              fullWidth
              placeholder={t('plans.new_dialog.name_placeholder')}
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
            />
            <TextField
              label={t('plans.new_dialog.description')}
              type="text"
              fullWidth
              multiline
              rows={2}
              placeholder={t('plans.new_dialog.description_placeholder')}
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel id="num-days-label">{t('plans.new_dialog.days')}</InputLabel>
              <Select
                labelId="num-days-label"
                value={numDays}
                label={t('plans.new_dialog.days')}
                onChange={(e) => setNumDays(parseInt(e.target.value, 10))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <MenuItem key={num} value={num}>
                    {t('plans.new_dialog.days_option', { count: num })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleAddPlan} variant="contained" disabled={!newPlan.name}>
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Modifica Scheda */}
      <Dialog open={openEditPlanDialog} onClose={handleCloseEditPlanDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('plans.edit_dialog.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              label={t('plans.new_dialog.name')}
              type="text"
              fullWidth
              value={editedPlanValues.name}
              onChange={(e) => setEditedPlanValues({ ...editedPlanValues, name: e.target.value })}
            />
            <TextField
              label={t('plans.new_dialog.description')}
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
          <Button onClick={handleCloseEditPlanDialog} disabled={updatePlanLoading}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleEditPlan} 
            variant="contained" 
            disabled={!editedPlanValues.name || updatePlanLoading}
            startIcon={updatePlanLoading ? <CircularProgress size={20} /> : null}
          >
            {updatePlanLoading ? t('plans.saving') : t('common.save')}
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
        <DialogTitle id="alert-dialog-title">{t('plans.delete_plan.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description" component="div">
            {t('plans.delete_plan.text')}
            <Box sx={{ mt: 1.5 }}>{t('plans.delete_plan.history_kept')}</Box>
            {goalAfterDelete !== null && (
              <Box sx={{ mt: 1.5 }}>{t('plans.delete_plan.goal_reset', { n: goalAfterDelete })}</Box>
            )}
            {planToDelete && (
              <Box sx={{ mt: 2, fontWeight: 'bold' }}>
                {t('plans.delete_plan.name', { name: planToDelete.name })}
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
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleConfirmDeletePlan} 
            color="error" 
            variant="contained"
            disabled={deletePlanLoading}
            startIcon={deletePlanLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deletePlanLoading ? t('plans.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteExerciseDialog}
        onClose={handleCloseDeleteExerciseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{t('plans.delete_exercise.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {t('plans.delete_exercise.text')}
            {exerciseToDelete && (
              <Box sx={{ mt: 2, fontWeight: 'bold' }}>
                {t('plans.delete_exercise.name', { name: exerciseToDelete.name })}
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
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleConfirmDeleteExercise} 
            color="error" 
            variant="contained"
            disabled={deleteExerciseLoading}
            startIcon={deleteExerciseLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteExerciseLoading ? t('plans.deleting') : t('common.delete')}
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
        <DialogTitle>{t('plans.edit_exercise.title')}</DialogTitle>
        <DialogContent>
          {exerciseToEdit && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="h6">{exerciseToEdit.exercise_name}</Typography>
              <Typography variant="body2" color="text.secondary">{muscleLabel(exerciseToEdit.muscle_group)}</Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  name="sets"
                  label={t('plans.edit_exercise.sets')}
                  type="number"
                  value={editedExerciseValues.sets}
                  onChange={handleEditExerciseChange}
                  fullWidth
                  InputProps={{ inputProps: { min: 1 } }}
                />
                <TextField
                  name="reps"
                  label={t('plans.edit_exercise.reps')}
                  value={editedExerciseValues.reps}
                  onChange={handleEditExerciseChange}
                  fullWidth
                />
              </Box>
              <TextField
                name="rest"
                label={t('plans.edit_exercise.rest')}
                type="number"
                value={editedExerciseValues.rest}
                onChange={handleEditExerciseChange}
                fullWidth
                InputProps={{ inputProps: { min: 0 } }}
              />
              
              <FormControl fullWidth>
                <InputLabel>{t('plans.edit_exercise.technique')}</InputLabel>
                <Select
                  name="intensity_technique"
                  value={editedExerciseValues.intensity_technique}
                  label={t('plans.edit_exercise.technique')}
                  onChange={handleEditExerciseChange}
                >
                  {INTENSITY_TECHNIQUES.map((tech) => (
                    <MenuItem key={tech} value={tech === 'Nessuna (Normale)' ? '' : tech}>
                      {techniqueLabel(tech)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                name="notes"
                label={t('plans.edit_exercise.notes')}
                value={editedExerciseValues.notes}
                onChange={handleEditExerciseChange}
                fullWidth
                multiline
                rows={3}
                placeholder={t('plans.edit_exercise.notes_placeholder')}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditExerciseDialog}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleConfirmEditExercise} 
            variant="contained"
            disabled={!editedExerciseValues.sets || !editedExerciseValues.reps || !editedExerciseValues.rest}
          >
            {t('plans.edit_exercise.save')}
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

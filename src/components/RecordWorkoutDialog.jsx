import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { API_BASE_URL } from '../config';
import { INTENSITY_TECHNIQUES } from './ExerciseDialog';

const RecordWorkoutDialog = ({ open, onClose, activePlan }) => {
  const [selectedDay, setSelectedDay] = useState('');
  const [exercises, setExercises] = useState([]);
  const [workoutData, setWorkoutData] = useState({});
  const [openNotes, setOpenNotes] = useState({});

  const handleDayChange = (event) => {
    const dayId = event.target.value;
    setSelectedDay(dayId);
    const selectedDayData = activePlan.days.find(day => day.id === dayId);
    setExercises(selectedDayData ? selectedDayData.exercises : []);
    
    // Initialize workout data for each exercise with multiple sets
    const initialWorkoutData = {};
    if (selectedDayData && selectedDayData.exercises) {
      selectedDayData.exercises.forEach(exercise => {
        initialWorkoutData[exercise.id] = Array(exercise.sets).fill().map(() => ({
          weight: '',
          reps: exercise.reps, // Default to planned reps
          intensity_technique: exercise.intensity_technique || '' // Default to planned intensity technique
        }));
      });
    }
    setWorkoutData(initialWorkoutData);
    
    // Reset open notes state
    setOpenNotes({});
  };

  const handleWorkoutDataChange = (exerciseId, setIndex, field, value) => {
    setWorkoutData(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, idx) =>
        idx === setIndex ? { ...set, [field]: value } : set
      )
    }));
  };

  const handleSubmit = async () => {
    try {
      // Modifica: filtriamo solo i set che sono stati compilati (hanno sia peso che ripetizioni)
      const workoutRecords = exercises.flatMap(exercise =>
        workoutData[exercise.id]
          .map((set, setIndex) => ({
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
            weight: parseFloat(set.weight),
            reps: set.reps, // Manteniamo il formato testuale delle ripetizioni
            intensity_technique: set.intensity_technique,
            day_id: selectedDay,
            set_number: setIndex + 1
          }))
          // Filtriamo per includere solo le serie che hanno sia peso che ripetizioni
          .filter(set => set.weight && !isNaN(set.weight) && set.reps && set.reps.toString().trim() !== '')
      );

      // Debug per verificare gli ID corretti degli esercizi
      console.log('WorkoutRecords con ID originali degli esercizi:', workoutRecords);
      console.log('Dettaglio esercizi utilizzati:');
      exercises.forEach(ex => {
        console.log(`- Esercizio: "${ex.exercise_name}" (ID nel piano: ${ex.id}, ID originale: ${ex.exercise_id})`);
      });

      const response = await fetch(`${API_BASE_URL}api/workout/record_workout.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Importante per inviare i cookie di sessione
        body: JSON.stringify({
          workout_records: workoutRecords
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Errore durante il salvataggio dell\'allenamento');
      }

      // Log dei dettagli della risposta per debug
      console.log('Risposta dal server:', responseData);

      onClose(true); // Close with success flag
    } catch (error) {
      console.error('Error recording workout:', error);
      onClose(false, error.message);
    }
  };

  const isValid = () => {
    if (!selectedDay || exercises.length === 0) return false;
    
    // Verifica se c'è almeno una serie valida per almeno un esercizio
    // Una serie è valida se ha sia peso che ripetizioni
    const hasValidSets = exercises.some(exercise => {
      const sets = workoutData[exercise.id];
      if (!sets) return false;
      
      // Controlla se c'è almeno un set con entrambi i valori inseriti
      // Ora accettiamo anche ripetizioni in formato testo
      return sets.some(set => 
        (set.weight && !isNaN(set.weight)) && 
        (set.reps && set.reps.toString().trim() !== '')
      );
    });
    
    // Richiede solo che ci sia almeno una serie completa in totale
    return hasValidSets;
  };

  // Funzione per gestire la visualizzazione delle note
  const toggleNotes = (exerciseId) => {
    setOpenNotes(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  // Funzione per determinare se le note sono troppo lunghe
  const isNotesTooLong = (notes) => {
    return notes && notes.length > 50;
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Registra Allenamento</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Seleziona Giorno</InputLabel>
            <Select
              value={selectedDay}
              label="Seleziona Giorno"
              onChange={handleDayChange}
            >
              {activePlan?.days?.map((day) => (
                <MenuItem key={day.id} value={day.id}>
                  {day.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {exercises.length > 0 && (
            <List>
              {exercises.map((exercise, index) => (
                <React.Fragment key={exercise.id}>
                  {index > 0 && <Divider sx={{ my: 2 }} />}
                  <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {exercise.exercise_name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {`${exercise.sets} serie x ${exercise.reps} - Recupero: ${exercise.rest}s`}
                          </Typography>
                          {exercise.notes && (
                            <Box sx={{ mt: 1 }}>
                              {isNotesTooLong(exercise.notes) ? (
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mr: 1 }}>
                                      Note: {exercise.notes.substring(0, 50)}...
                                    </Typography>
                                    <IconButton 
                                      size="small" 
                                      color="primary" 
                                      onClick={() => toggleNotes(exercise.id)}
                                      aria-label="mostra note"
                                    >
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                  <Collapse in={openNotes[exercise.id] || false}>
                                    <Alert 
                                      severity="info" 
                                      sx={{ mt: 1 }}
                                      action={
                                        <IconButton
                                          aria-label="chiudi"
                                          color="inherit"
                                          size="small"
                                          onClick={() => toggleNotes(exercise.id)}
                                        >
                                          <InfoIcon fontSize="inherit" />
                                        </IconButton>
                                      }
                                    >
                                      {exercise.notes}
                                    </Alert>
                                  </Collapse>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  Note: {exercise.notes}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ mt: 2 }}>
                      {Array(exercise.sets).fill().map((_, setIndex) => (
                        <Box key={setIndex} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                          <Typography variant="body2" sx={{ minWidth: 60, display: 'flex', alignItems: 'center' }}>
                            Serie {setIndex + 1}:
                          </Typography>
                          <TextField
                            label="Peso (kg)"
                            type="number"
                            value={workoutData[exercise.id]?.[setIndex]?.weight || ''}
                            onChange={(e) => handleWorkoutDataChange(exercise.id, setIndex, 'weight', e.target.value)}
                            fullWidth
                            size="small"
                          />
                          <TextField
                            label="Ripetizioni"
                            value={workoutData[exercise.id]?.[setIndex]?.reps || exercise.reps}
                            onChange={(e) => handleWorkoutDataChange(exercise.id, setIndex, 'reps', e.target.value)}
                            fullWidth
                            size="small"
                          />
                          <FormControl fullWidth size="small">
                            <InputLabel>Tecnica</InputLabel>
                            <Select
                              value={workoutData[exercise.id]?.[setIndex]?.intensity_technique || ''}
                              label="Tecnica"
                              onChange={(e) => handleWorkoutDataChange(exercise.id, setIndex, 'intensity_technique', e.target.value)}
                            >
                              <MenuItem value=""><em>Nessuna</em></MenuItem>
                              {INTENSITY_TECHNIQUES.filter(t => t !== 'Nessuna (Normale)').map(tech => (
                                <MenuItem key={tech} value={tech}>{tech}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ))}
                    </Box>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Annulla</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!isValid()}
        >
          Salva
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecordWorkoutDialog;
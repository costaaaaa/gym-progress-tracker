import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  CircularProgress,
  Autocomplete,
  Typography
} from '@mui/material';
import { API_BASE_URL } from '../config';

// Normalizzo i nomi dei gruppi muscolari per essere coerenti con il resto dell'applicazione
const muscleGroups = [
  'Petto',
  'Schiena',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Gambe',
  'Polpacci',
  'Addominali'
];

export const INTENSITY_TECHNIQUES = [
  'Nessuna (Normale)',
  'Drop Set (Stripping)',
  'Rest Pause',
  'Super Set',
  'Jump Set',
  'Negative',
  'Ripetizioni Forzate',
  'Isometria',
  'Peak Contraction',
  'Myo-Reps'
];

const ExerciseDialog = ({ open, onClose, onAdd, dayIndex }) => {
  const [exercise, setExercise] = useState({
    name: '',
    sets: '',
    reps: '',
    rest: '',
    notes: '',
    muscleGroup: '',
    intensity_technique: ''
  });

  // Stato per gli esercizi caricati dal database
  const [exercises, setExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [inputValue, setInputValue] = useState('');

  // Carica gli esercizi quando cambia il gruppo muscolare
  useEffect(() => {
    if (exercise.muscleGroup) {
      fetchExercises(exercise.muscleGroup);
    } else {
      setExercises([]);
      setFilteredExercises([]);
    }
  }, [exercise.muscleGroup]);

  // Funzione per caricare gli esercizi dal database
  const fetchExercises = async (muscleGroup) => {
    setLoadingExercises(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/exercise/read_all.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.records && Array.isArray(data.records)) {
        // Filtriamo gli esercizi per il gruppo muscolare selezionato
        const filteredExercises = data.records.filter(ex => {
          // Mappatura diretta dei gruppi muscolari
          if (muscleGroup === 'Bicipiti') {
            return ex.muscle_group === 'bicipiti';
          } else if (muscleGroup === 'Tricipiti') {
            return ex.muscle_group === 'tricipiti';
          } else if (muscleGroup === 'Polpacci') {
            return ex.muscle_group === 'polpacci';
          }
          // Per gli altri gruppi muscolari, confronto normale
          return ex.muscle_group.toLowerCase() === muscleGroup.toLowerCase();
        });
        
        setExercises(filteredExercises);
        setFilteredExercises(filteredExercises);
      } else {
        setExercises([]);
        setFilteredExercises([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli esercizi:', error);
      setExercises([]);
      setFilteredExercises([]);
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setExercise(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Gestione dell'autocomplete per il nome dell'esercizio
  const handleExerciseChange = (event, newValue) => {
    if (newValue) {
      console.log('Esercizio selezionato:', newValue);
      setExercise(prev => ({
        ...prev,
        name: newValue.name,
        id: newValue.id // Questo è l'ID originale dalla tabella gym_exercises
      }));
    }
  };

  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue);
    // Filtriamo qui in modo che anche la digitazione parziale mostri risultati
    if (exercises.length > 0) {
      const filtered = exercises.filter(ex => 
        ex.name.toLowerCase().includes(newInputValue.toLowerCase())
      );
      setFilteredExercises(filtered);
    }
  };

  const handleSubmit = () => {
    onAdd(dayIndex, exercise);
    setExercise({
      name: '',
      sets: '',
      reps: '',
      rest: '',
      notes: '',
      muscleGroup: '',
      intensity_technique: ''
    });
    setInputValue('');
    onClose();
  };

  const isValid = 
    exercise.name && 
    exercise.sets && 
    exercise.reps && 
    exercise.rest && 
    exercise.muscleGroup;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Aggiungi Esercizio</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Gruppo Muscolare</InputLabel>
            <Select
              name="muscleGroup"
              value={exercise.muscleGroup}
              label="Gruppo Muscolare"
              onChange={handleChange}
            >
              {muscleGroups.map((group) => (
                <MenuItem key={group} value={group}>
                  {group}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {exercise.muscleGroup && (
            loadingExercises ? (
              <Box display="flex" alignItems="center" justifyContent="center" p={2}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography variant="body2">Caricamento esercizi...</Typography>
              </Box>
            ) : (
              <Autocomplete
                value={exercises.find(ex => ex.name === exercise.name) || null}
                onChange={handleExerciseChange}
                inputValue={inputValue}
                onInputChange={handleInputChange}
                options={filteredExercises}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Nome Esercizio" 
                    fullWidth
                    helperText={filteredExercises.length === 0 && inputValue ? "Nessun esercizio trovato" : ""}
                  />
                )}
                noOptionsText="Nessun esercizio trovato"
                fullWidth
              />
            )
          )}
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              name="sets"
              label="Serie"
              type="number"
              value={exercise.sets}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="reps"
              label="Ripetizioni"
              type="text"
              fullWidth
              value={exercise.reps}
              onChange={(e) => setExercise({ ...exercise, reps: e.target.value })}
            />
            <TextField
              name="rest"
              label="Recupero (s)"
              type="number"
              fullWidth
              value={exercise.rest}
              onChange={(e) => setExercise({ ...exercise, rest: e.target.value })}
            />
          </Box>
          
          <FormControl fullWidth>
            <InputLabel>Tecnica di Intensità (Opzionale)</InputLabel>
            <Select
              name="intensity_technique"
              value={exercise.intensity_technique}
              label="Tecnica di Intensità (Opzionale)"
              onChange={handleChange}
            >
              {INTENSITY_TECHNIQUES.map((tech) => (
                <MenuItem key={tech} value={tech === 'Nessuna (Normale)' ? '' : tech}>
                  {tech}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
            
          <TextField
            margin="dense"
            label="Note"
            multiline
            rows={3}
            fullWidth
            value={exercise.notes || ''}
            onChange={(e) => setExercise({ ...exercise, notes: e.target.value })}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!isValid}
        >
          Aggiungi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExerciseDialog;
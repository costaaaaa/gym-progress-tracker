import { useState, useEffect } from 'react';
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
  Typography,
  Chip,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { API_BASE_URL } from '../config';
import { createExercise, errorMessage, findSimilarExercises, personalLabel } from '../api/exercises';
import { equipmentLabel, exerciseMatches } from '../utils/exerciseCatalog';

// Helper per rendere maiuscola la prima lettera
const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

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
  const [allExercises, setAllExercises] = useState([]);
  const [availableMuscleGroups, setAvailableMuscleGroups] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // Carica tutti gli esercizi quando il dialog viene aperto per estrarre i gruppi muscolari
  useEffect(() => {
    if (open) {
      fetchAllExercises();
    }
  }, [open]);

  // "Forse cercavi": esercizi con un nome simile a quello da creare, chiesti al server mentre si scrive
  useEffect(() => {
    const name = newName.trim();
    if (name.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await findSimilarExercises(name);
      if (!cancelled) setSuggestions(res.ok ? res.data.records : []);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [newName]);

  // Filtra gli esercizi quando cambia il gruppo muscolare selezionato
  useEffect(() => {
    if (exercise.muscleGroup && allExercises.length > 0) {
      const filtered = allExercises.filter(ex => 
        capitalize(ex.muscle_group) === exercise.muscleGroup
      );
      setExercises(filtered);
    } else {
      setExercises([]);
    }
  }, [exercise.muscleGroup, allExercises]);

  // Attrezzi presenti nel gruppo scelto, per il filtro
  const groupEquipment = [...new Set(exercises.map(ex => ex.equipment).filter(Boolean))];

  // Funzione per caricare tutti gli esercizi dal database
  const fetchAllExercises = async () => {
    setLoadingExercises(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/exercise/read_all.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.records && Array.isArray(data.records)) {
        setAllExercises(data.records);
        
        // Estraiamo i gruppi muscolari univoci e formattiamoli
        const groups = [...new Set(data.records.map(ex => capitalize(ex.muscle_group)))]
          .filter(Boolean)
          .sort();
        
        setAvailableMuscleGroups(groups);
      } else {
        setAllExercises([]);
        setAvailableMuscleGroups([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli esercizi:', error);
      setAllExercises([]);
      setAvailableMuscleGroups([]);
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

  const handleMuscleGroupChange = (e) => {
    setExercise(prev => ({ ...prev, muscleGroup: e.target.value, name: '', id: undefined }));
    setEquipmentFilter('');
    setNewName('');
    setCreateError('');
  };

  // Gestione dell'autocomplete per il nome dell'esercizio
  const handleExerciseChange = (event, newValue) => {
    if (newValue) {
      setExercise(prev => ({
        ...prev,
        name: newValue.name,
        id: newValue.id // Questo è l'ID originale dalla tabella gym_exercises
      }));
      setNewName('');
    }
  };

  const handleInputChange = (event, newInputValue, reason) => {
    setInputValue(newInputValue);
    // Quello che si cerca precompila "Non lo trovi? Crealo"
    if (reason === 'input') setNewName(newInputValue);
    setCreateError('');
  };

  // Esercizio personale nel gruppo scelto. Se esiste già (409 duplicate) si seleziona quello.
  const typedName = newName.trim();
  const canCreate = typedName.length >= 2 && !creating;

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    const res = await createExercise(typedName, exercise.muscleGroup);
    setCreating(false);
    const created = res.data?.exercise;
    // 409 duplicate: esiste già (anche con maiuscole diverse o in un altro gruppo), lo si seleziona
    if (!created || !(res.ok || res.data?.code === 'duplicate')) {
      setCreateError(errorMessage(res));
      return;
    }
    setAllExercises(prev => prev.some(ex => ex.id === created.id) ? prev : [...prev, created]);
    setExercise(prev => ({
      ...prev,
      muscleGroup: capitalize(created.muscle_group),
      name: created.name,
      id: created.id
    }));
    setInputValue(created.name);
    setNewName('');
  };

  // Sceglie un esercizio proposto da "Forse cercavi", anche se è in un altro gruppo muscolare
  const handleSuggestion = (suggestion) => {
    const known = allExercises.find(ex => String(ex.id) === String(suggestion.id));
    const chosen = known || suggestion;
    if (!known) setAllExercises(prev => [...prev, suggestion]);
    setExercise(prev => ({
      ...prev,
      muscleGroup: capitalize(chosen.muscle_group),
      name: chosen.name,
      id: chosen.id
    }));
    setInputValue(chosen.name);
    setNewName('');
    setCreateError('');
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
    setNewName('');
    setCreateError('');
    onClose();
  };

  const intInRange = (value, min, max) => /^\d+$/.test(String(value)) && Number(value) >= min && Number(value) <= max;
  const isValid = Boolean(
    exercise.name &&
    exercise.muscleGroup &&
    intInRange(exercise.sets, 1, 20) &&
    String(exercise.reps).trim() &&
    exercise.reps.length <= 20 &&
    intInRange(exercise.rest, 0, 3600)
  );

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
              onChange={handleMuscleGroupChange}
            >
              {availableMuscleGroups.map((group) => (
                <MenuItem key={group} value={group}>
                  {group}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {exercise.muscleGroup && !loadingExercises && groupEquipment.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="Tutti gli attrezzi"
                size="small"
                color={equipmentFilter ? 'default' : 'primary'}
                onClick={() => setEquipmentFilter('')}
              />
              {groupEquipment.map(eq => (
                <Chip
                  key={eq}
                  label={equipmentLabel(eq) || eq}
                  size="small"
                  color={equipmentFilter === eq ? 'primary' : 'default'}
                  onClick={() => setEquipmentFilter(eq)}
                />
              ))}
            </Box>
          )}

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
                options={exercises.filter(ex => !equipmentFilter || ex.equipment === equipmentFilter || ex.id === exercise.id)}
                filterOptions={(options, { inputValue: typed }) => options.filter(ex => exerciseMatches(ex, typed))}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  const label = personalLabel(option);
                  return (
                    <Box component="li" key={key} {...optionProps} sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                      <span>{option.name}</span>
                      {label && <Chip label={label} size="small" variant="outlined" />}
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Nome Esercizio" 
                    fullWidth
                    helperText={personalLabel(exercises.find(ex => ex.id === exercise.id)) || ''}
                  />
                )}
                noOptionsText="Nessun esercizio trovato"
                fullWidth
              />
            )
          )}

          {exercise.muscleGroup && !loadingExercises && (
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1 }}>Non lo trovi? Crealo</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  fullWidth
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
                  placeholder={`Nuovo esercizio (${exercise.muscleGroup.toLowerCase()})`}
                  inputProps={{ maxLength: 60 }}
                />
                <Button
                  variant="outlined"
                  startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
                  onClick={handleCreate}
                  disabled={!canCreate}
                >
                  Crea
                </Button>
              </Box>
              {suggestions.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Forse cercavi:</Typography>
                  {suggestions.map(s => (
                    <Chip
                      key={s.id}
                      label={`${s.name} · ${s.muscle_group}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={() => handleSuggestion(s)}
                    />
                  ))}
                </Box>
              )}
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                Lo vedi solo tu finché non viene controllato e aggiunto al catalogo di tutti.
              </Typography>
            </Box>
          )}
          {createError && <Alert severity="error">{createError}</Alert>}
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              name="sets"
              label="Serie"
              type="number"
              inputProps={{ min: 1, max: 20, step: 1 }}
              value={exercise.sets}
              onChange={handleChange}
              fullWidth
              sx={{
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                  display: 'none',
                },
                '& input[type=number]': {
                  MozAppearance: 'textfield',
                },
              }}
            />
            <TextField
              name="reps"
              label="Ripetizioni"
              type="text"
              fullWidth
              value={exercise.reps}
              inputProps={{ maxLength: 20 }}
              onChange={(e) => setExercise({ ...exercise, reps: e.target.value })}
            />
            <TextField
              name="rest"
              label="Recupero (s)"
              type="number"
              inputProps={{ min: 0, max: 3600, step: 1 }}
              fullWidth
              value={exercise.rest}
              onChange={(e) => setExercise({ ...exercise, rest: e.target.value })}
              sx={{
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                  display: 'none',
                },
                '& input[type=number]': {
                  MozAppearance: 'textfield',
                },
              }}
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
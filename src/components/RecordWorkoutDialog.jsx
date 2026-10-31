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
  Collapse,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { API_BASE_URL } from '../config';
import { track } from '../utils/analytics';
import { useTranslation } from 'react-i18next';
import { INTENSITY_TECHNIQUES, NO_TECHNIQUE, techniqueLabel } from '../i18n/labels';
import {
  MAX_WEIGHT, isValidWeight, newIdempotencyKey, isValidReps, repsNeedConfirm, withWarmupRule,
} from '../utils/focusSession';
import { initialSetRows, toggleWarmupRow, rowPlanReps, rowPlannedSet } from '../utils/manualEntryRows';
import { planSummary } from '../utils/plannedSets';

const RecordWorkoutDialog = ({ open, onClose, activePlan }) => {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState('');
  const [exercises, setExercises] = useState([]);
  const [workoutData, setWorkoutData] = useState({});
  const [openNotes, setOpenNotes] = useState({});
  // Stessa chiave a ogni tentativo dello stesso allenamento (vedi newIdempotencyKey)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [repsError, setRepsError] = useState('');
  // Serie con ripetizioni insolite da confermare prima di salvare: { name, set, reps } o null
  const [unusualSet, setUnusualSet] = useState(null);

  const handleDayChange = (event) => {
    const dayId = event.target.value;
    setSelectedDay(dayId);
    setIdempotencyKey(newIdempotencyKey());
    const selectedDayData = activePlan.days.find(day => day.id === dayId);
    setExercises(selectedDayData ? selectedDayData.exercises : []);
    
    // Initialize workout data for each exercise with multiple sets
    const initialWorkoutData = {};
    if (selectedDayData && selectedDayData.exercises) {
      selectedDayData.exercises.forEach(exercise => {
        // Prima le righe del riscaldamento della scheda, poi le serie allenanti
        initialWorkoutData[exercise.id] = initialSetRows(exercise);
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

  // Attiva o disattiva il riscaldamento di una riga: le ripetizioni precompilate seguono la nuova posizione
  const handleWarmupToggle = (exercise, setIndex) => {
    setWorkoutData(prev => ({
      ...prev,
      [exercise.id]: toggleWarmupRow(prev[exercise.id], setIndex, exercise)
    }));
  };

  // Serie scritte (peso valido e ripetizioni presenti): quelle senza ripetizioni non sono state fatte
  const writtenSets = () => exercises.flatMap(exercise =>
    (workoutData[exercise.id] || [])
      .map((set, setIndex) => ({
        exercise, setIndex, reps: String(set.reps ?? '').trim(), weight: set.weight,
        planned: rowPlannedSet(workoutData[exercise.id], setIndex, exercise),
      }))
      .filter(set => isValidWeight(set.weight) && set.reps !== ''));

  const handleSave = () => {
    const written = writtenSets();
    const invalid = written.find(set => !isValidReps(set.reps));
    if (invalid) {
      setRepsError(t('record.invalid_reps', { exercise: invalid.exercise.exercise_name, n: invalid.setIndex + 1 }));
      return;
    }
    setRepsError('');
    const unusual = written.find(set => repsNeedConfirm(set.reps, set.planned));
    if (unusual) {
      setUnusualSet({ reps: parseInt(unusual.reps, 10) });
      return;
    }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setUnusualSet(null);
    try {
      // Modifica: filtriamo solo i set che sono stati compilati (hanno sia peso che ripetizioni)
      const workoutRecords = exercises.flatMap(exercise =>
        workoutData[exercise.id]
          .map((row, setIndex) => {
            const { intensity_technique, is_warmup } = withWarmupRule(row);
            return {
              exercise_id: exercise.exercise_id,
              exercise_name: exercise.exercise_name,
              weight: parseFloat(row.weight),
              reps: String(row.reps ?? '').trim(),
              intensity_technique,
              is_warmup,
              day_id: selectedDay,
              set_number: setIndex + 1
            };
          })
          // Filtriamo per includere solo le serie che hanno sia peso che ripetizioni
          .filter(set => isValidWeight(set.weight) && set.reps && set.reps.toString().trim() !== '')
      );

      const response = await fetch(`${API_BASE_URL}api/workout/record_workout.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Importante per inviare i cookie di sessione
        body: JSON.stringify({
          workout_records: workoutRecords,
          idempotency_key: idempotencyKey
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || t('record.save_error'));
      }

      // Il prossimo allenamento registrato da qui è un altro: chiave nuova
      setIdempotencyKey(newIdempotencyKey());
      if (!responseData.already_saved) {
        track('workout_saved');
        if (responseData.total_sessions === 1) track('first_workout');
      }

      onClose(true, null, { alreadySaved: !!responseData.already_saved }); // Close with success flag
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
        isValidWeight(set.weight) &&
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
      <DialogTitle>{t('record.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>{t('record.select_day')}</InputLabel>
            <Select
              value={selectedDay}
              label={t('record.select_day')}
              onChange={handleDayChange}
            >
              {activePlan?.days?.map((day) => (
                <MenuItem key={day.id} value={day.id}>
                  {day.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {exercises.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {t('record.select_day_hint')}
            </Typography>
          )}

          {exercises.length > 0 && (
            <List sx={{ p: 0 }}>
              {exercises.map((exercise, index) => (
                <React.Fragment key={exercise.id}>
                  {index > 0 && <Divider sx={{ my: 2.5 }} />}
                  <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', p: 0 }}>
                    <ListItemText
                      primary={
                        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.25 }}>
                          {exercise.exercise_name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('plans.plan_line', { summary: planSummary(exercise.planned_sets), rest: exercise.rest })}
                          </Typography>
                          {exercise.notes && (
                            <Box sx={{ mt: 1 }}>
                              {isNotesTooLong(exercise.notes) ? (
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mr: 1 }}>
                                      {t('record.notes_truncated', { notes: exercise.notes.substring(0, 50) })}
                                    </Typography>
                                    <IconButton 
                                      size="small" 
                                      color="primary" 
                                      onClick={() => toggleNotes(exercise.id)}
                                      aria-label={t('record.show_notes')}
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
                                          aria-label={t('record.close')}
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
                                  {t('record.notes', { notes: exercise.notes })}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ mt: 2 }}>
                      {(workoutData[exercise.id] || []).map((row, setIndex, rows) => (
                        <Box key={setIndex} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                          <Box sx={{ minWidth: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="body2">{t('record.set', { n: setIndex + 1 })}</Typography>
                            <FormControlLabel
                              label={t('common.warmup_badge')}
                              slotProps={{ typography: { variant: 'caption' } }}
                              sx={{ m: 0 }}
                              control={
                                <Checkbox
                                  size="small"
                                  sx={{ p: 0.5 }}
                                  checked={!!row.is_warmup}
                                  onChange={() => handleWarmupToggle(exercise, setIndex)}
                                  inputProps={{ 'aria-label': t('record.warmup_aria', { n: setIndex + 1 }) }}
                                />
                              }
                            />
                          </Box>
                          <TextField
                            label={t('record.weight')}
                            type="number"
                            value={row.weight || ''}
                            onChange={(e) => handleWorkoutDataChange(exercise.id, setIndex, 'weight', e.target.value)}
                            inputProps={{ min: 0, max: MAX_WEIGHT, step: 0.5 }}
                            fullWidth
                            size="small"
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
                            label={t('record.reps')}
                            value={row.reps ?? ''}
                            // La scheda indica le ripetizioni per le sole righe che ora non sono riscaldamento
                            placeholder={rowPlanReps(rows, setIndex, exercise)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleWorkoutDataChange(exercise.id, setIndex, 'reps', e.target.value)}
                            fullWidth
                            size="small"
                          />
                          <FormControl fullWidth size="small">
                            <InputLabel>{t('record.technique')}</InputLabel>
                            <Select
                              disabled={!!row.is_warmup}
                              value={row.is_warmup ? '' : (row.intensity_technique || '')}
                              label={t('record.technique')}
                              onChange={(e) => handleWorkoutDataChange(exercise.id, setIndex, 'intensity_technique', e.target.value)}
                            >
                              <MenuItem value=""><em>{t('record.no_technique')}</em></MenuItem>
                              {INTENSITY_TECHNIQUES.filter(tech => tech !== NO_TECHNIQUE).map(tech => (
                                <MenuItem key={tech} value={tech}>{techniqueLabel(tech)}</MenuItem>
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
        {repsError && <Alert severity="error" sx={{ mt: 2 }}>{repsError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>{t('common.cancel')}</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={!isValid()}
        >
          {t('common.save')}
        </Button>
      </DialogActions>

      <Dialog open={!!unusualSet} onClose={() => setUnusualSet(null)}>
        <DialogTitle>{t('record.confirm_reps', { reps: unusualSet?.reps })}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setUnusualSet(null)}>{t('record.fix')}</Button>
          <Button onClick={handleSubmit} variant="contained">{t('record.confirm_yes')}</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RecordWorkoutDialog;
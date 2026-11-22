import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PlannedSetsEditor from '../../components/PlannedSetsEditor';
import { muscleLabel } from '../../i18n/labels';

const valuesOf = (exercise) => ({ rest: exercise?.rest ?? '', notes: exercise?.notes || '' });

// Recupero, note e serie di un esercizio del giorno `dayId`. `dayId` ed `exercise` restano valorizzati finché il
// dialog si chiude (i campi ripartono da lì a ogni esercizio nuovo). `onSave(valori, chiudi)` salva; `chiudi` va
// chiamato quando il server ha risposto.
const EditExerciseDialog = ({ open, dayId, exercise, onClose, onSave }) => {
  const { t } = useTranslation();
  const [editedExerciseValues, setEditedExerciseValues] = useState(() => valuesOf(exercise));
  const [editedPlannedSets, setEditedPlannedSets] = useState(null);

  // I campi ripartono dall'esercizio appena cambiato, prima che l'editor delle serie venga disegnato (che
  // comunica subito le sue serie)
  const [lastExercise, setLastExercise] = useState(exercise);
  if (exercise !== lastExercise) {
    setLastExercise(exercise);
    setEditedExerciseValues(valuesOf(exercise));
    setEditedPlannedSets(null);
  }

  // Gestione cambiamenti nei campi del form di modifica
  const handleEditExerciseChange = (e) => {
    const { name, value } = e.target;
    setEditedExerciseValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    if (!exercise || !dayId) return;
    onSave({
      dayId,
      exercise,
      plannedSets: editedPlannedSets,
      rest: editedExerciseValues.rest,
      notes: editedExerciseValues.notes
    }, onClose);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t('plans.edit_exercise.title')}</DialogTitle>
      <DialogContent>
        {exercise && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="h6">{exercise.exercise_name}</Typography>
            <Typography variant="body2" color="text.secondary">{muscleLabel(exercise.muscle_group)}</Typography>

            <PlannedSetsEditor
              key={exercise.id}
              value={exercise.planned_sets?.length ? exercise.planned_sets : null}
              onChange={setEditedPlannedSets}
            />
            <TextField
              name="rest"
              label={t('plans.edit_exercise.rest')}
              type="number"
              value={editedExerciseValues.rest}
              onChange={handleEditExerciseChange}
              fullWidth
              InputProps={{ inputProps: { min: 0 } }}
            />

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
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!editedPlannedSets || !editedExerciseValues.rest}
        >
          {t('plans.edit_exercise.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditExerciseDialog;

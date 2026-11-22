import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PlannedSetsEditor from '../../components/PlannedSetsEditor';
import { muscleLabel } from '../../i18n/labels';

const valuesOf = (exercise) => ({ rest: exercise?.rest ?? '', notes: exercise?.notes || '' });

// Recupero, note e serie di un esercizio. `target` è `{ dayId, exercise }` e resta valorizzato finché il dialog si
// chiude; a ogni apertura i campi ripartono da lì. `onSave(target, valori, onAnswered)` salva e chiama
// `onAnswered` appena il server ha risposto: qui è la chiusura del dialog.
const EditExerciseDialog = ({ open, target, onClose, onSave }) => {
  const exercise = target?.exercise;
  const { t } = useTranslation();
  const [editedExerciseValues, setEditedExerciseValues] = useState(() => valuesOf(exercise));
  const [editedPlannedSets, setEditedPlannedSets] = useState(null);

  // A ogni apertura i campi ripartono dall'esercizio, durante il render e non in un effetto: l'editor delle serie
  // comunica le sue appena montato, e un effetto qui le cancellerebbe
  const [last, setLast] = useState({ target, open });
  if (target !== last.target || open !== last.open) {
    setLast({ target, open });
    if (open) {
      setEditedExerciseValues(valuesOf(exercise));
      setEditedPlannedSets(null);
    }
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
    if (!exercise || !target.dayId) return;
    onSave(target, {
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

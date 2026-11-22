import { Box, Typography, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { radius } from '../../theme/radius';
import { formatSetText } from '../../i18n/format';
import { techniqueLabel } from '../../i18n/labels';
import { isWorkingSet } from '../../utils/workoutMetrics';
import WarmupBadge from '../../components/WarmupBadge';

// Determina il formato dei dati e organizza gli esercizi di un allenamento in modo uniforme
// (ex helper interno di WorkoutDetailDialog: il backend restituisce righe storiche in due forme
// diverse — array `sets` oppure campi flat weight/reps/set_number — da normalizzare qui).
const organizeExercises = (exercises) => {
  if (!Array.isArray(exercises)) return [];

  return exercises.map((exercise, index) => {
    const exerciseCopy = JSON.parse(JSON.stringify(exercise));

    exerciseCopy.id = exercise.exercise_id ||
      (exercise.name ? `temp-${exercise.name.toLowerCase().replace(/\s+/g, '-')}` : `unknown-${index}`);
    exerciseCopy.name = exercise.exercise_name || exercise.name || 'Esercizio senza nome';

    if (!exerciseCopy.sets) {
      exerciseCopy.sets = [{
        set_number: exercise.set_number || 1,
        weight: exercise.weight || 0,
        reps: exercise.reps || 0,
        intensity_technique: exercise.intensity_technique || null
      }];
    }

    return exerciseCopy;
  });
};

// Dettaglio esercizi di un allenamento (ex contenuto di WorkoutDetailDialog): note, esercizi, serie, riscaldamento,
// tecnica. Senza stato: riceve l'allenamento e l'unità di peso con cui scrivere le serie.
const WorkoutDetail = ({ workout, weightUnit }) => {
  const { t } = useTranslation();
  const exercises = organizeExercises(workout.exercises);
  const hasExercises = exercises.length > 0;

  return (
    <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
      {workout.notes && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary', mb: 0.5 }}>
            {t('history.notes_caps')}
          </Typography>
          <Box sx={{
            bgcolor: 'background.subtle',
            borderRadius: radius.md, p: 1.5,
          }}>
            <Typography sx={{ fontSize: 16 }}>{workout.notes}</Typography>
          </Box>
        </Box>
      )}

      {!hasExercises ? (
        <Alert severity="info">{t('history.no_detail_workout')}</Alert>
      ) : (
        exercises.map((exercise, index) => (
          <Box key={exercise.id + '-' + index} sx={{ mb: index < exercises.length - 1 ? 2 : 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{exercise.name}</Typography>
              <Box sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: radius.sm,
                px: 1.25, py: 0.4, fontSize: 16, fontWeight: 600, color: 'text.secondary', flexShrink: 0,
              }}>
                {t('history.sets_count', { count: exercise.sets.filter(isWorkingSet).length })}
              </Box>
            </Box>
            {exercise.sets.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {exercise.sets.map((set, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5,
                      bgcolor: 'background.subtle',
                      borderRadius: radius.sm, px: 1.75, py: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('focus.set_n', { n: idx + 1 })}</Typography>
                      {set.is_warmup && <WarmupBadge sx={{ fontSize: 16 }} />}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatSetText(set.weight, set.reps, weightUnit)}</Typography>
                      {set.intensity_technique && (
                        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{techniqueLabel(set.intensity_technique)}</Typography>
                      )}
                    </Box>
                  </Box>
                ))}
                {exercise.notes && (
                  <Typography sx={{ fontSize: 16, color: 'text.secondary', fontStyle: 'italic' }}>{t('history.exercise_notes', { notes: exercise.notes })}</Typography>
                )}
              </Box>
            ) : (
              <Alert severity="warning">{t('history.no_detail_exercise')}</Alert>
            )}
          </Box>
        ))
      )}
    </Box>
  );
};

export default WorkoutDetail;

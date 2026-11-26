import { Box, Button, Card, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';
import { planSummary } from '../../utils/plannedSets';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { ACTIONS_ROW, DANGER_TEXT, NEUTRAL_OUTLINED, flushTextButton, flushTextButtonInActionsRow } from '../../utils/buttonStyles';

// Comando a icona: area toccabile di 44 px
const CONTROL_SX = { width: 44, height: 44, minWidth: 44, minHeight: 44, color: 'text.secondary' };

// Il riquadro di un giorno: nome e tutti gli esercizi, nell'ordine. Non tiene stato né chiama il server: cosa è
// acceso (`editing`, `canStart`) e cosa fare sui comandi lo decide la pagina. In sola lettura (`readOnly`) i comandi
// degli esercizi e «Aggiungi esercizio» non ci sono; «Elimina giorno» c'è solo con più di un giorno (`canDelete`).
const PlanDay = ({
  day, editing, readOnly, canStart, canDelete,
  onStart, onAddExercise, onDeleteDay, onEditExercise, onDeleteExercise, onMoveExercise,
}) => {
  const { t } = useTranslation();
  const exercises = day.exercises || [];

  return (
    <Card sx={{ height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 20 }}>
        {day.name}
      </Typography>

      {exercises.length > 0 ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}>
          {exercises.map((exercise, index) => (
            <Box
              component="li"
              key={exercise.id}
              sx={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 1,
                borderTop: index > 0 ? '1px solid' : 'none', borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{exercise.exercise_name}</Typography>
                <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
                  {t('plans.plan_line', { summary: planSummary(exercise.planned_sets), rest: exercise.rest })}
                </Typography>
                {exercise.notes && (
                  <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, fontStyle: 'italic' }}>
                    {t('plans.notes', { notes: exercise.notes })}
                  </Typography>
                )}
              </Box>
              {/* Margine negativo sul gruppo, pari al rientro delle icone (44 px di area, 20 di icona): ciò che si vede parte dal bordo del testo */}
              {editing && !readOnly && (
                <Box sx={{ display: 'flex', flexShrink: 0, mx: -1.5 }}>
                  <IconButton
                    aria-label={t('plans.move_up.aria', { name: exercise.exercise_name })}
                    disabled={index === 0}
                    onClick={() => onMoveExercise(day, exercise, 'up')}
                    sx={CONTROL_SX}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={t('plans.move_down.aria', { name: exercise.exercise_name })}
                    disabled={index === exercises.length - 1}
                    onClick={() => onMoveExercise(day, exercise, 'down')}
                    sx={CONTROL_SX}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={t('plans.edit_exercise.aria', { name: exercise.exercise_name })}
                    onClick={() => onEditExercise({ dayId: day.id, exercise })}
                    sx={CONTROL_SX}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={t('plans.delete_exercise.aria', { name: exercise.exercise_name })}
                    onClick={() => onDeleteExercise({ dayId: day.id, exercise })}
                    sx={CONTROL_SX}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('plans.no_exercises')}</Typography>
      )}

      {!editing && canStart && (
        <Button
          variant="contained"
          onClick={() => onStart(day)}
          aria-label={t('plans.start_day_aria', { day: day.name })}
          sx={{ alignSelf: 'flex-start', minHeight: 44, fontSize: 16, fontWeight: 600 }}
        >
          {t('plans.start_day')}
        </Button>
      )}

      {editing && (!readOnly || canDelete) && (
        <Box sx={{ ...ACTIONS_ROW, mt: 'auto' }}>
          {!readOnly && (
            <Button variant="outlined" color="inherit" startIcon={<AddIcon />} onClick={onAddExercise} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44 }}>
              {t('plans.add_exercise')}
            </Button>
          )}
          {/* Il margine negativo porta l'etichetta al bordo del testo della card: in sola lettura è l'unico bottone della riga */}
          {canDelete && (
            <Button
              onClick={() => onDeleteDay(day)}
              aria-label={t('plans.delete_day.aria', { name: day.name })}
              sx={(theme) => ({ ...DANGER_TEXT, ...(readOnly ? flushTextButton('left') : flushTextButtonInActionsRow(theme)) })}
            >
              {t('plans.delete_day_action')}
            </Button>
          )}
        </Box>
      )}
    </Card>
  );
};

export default PlanDay;

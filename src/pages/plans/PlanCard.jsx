import {
  Typography, Button, Box, Card, CardContent, CardActions, IconButton, Divider, ButtonGroup, Collapse
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../../i18n/labels';
import { planSummary, planSummaryCompact } from '../../utils/plannedSets';
import { planCardSummary } from '../../utils/planCard';
import FitNames from '../../components/FitNames';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { radius } from '../../theme/radius';
import ReadOnlyNotice, { readOnlyOnCard } from './ReadOnlyNotice';

const MAX_EXERCISE_ROWS = 4; // esercizi mostrati per giorno nella card aperta
const DAY_LINK_SX = { fontSize: 12, fontWeight: 600, textTransform: 'none', minWidth: 0, p: 0 };

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

// La card di una scheda: chiusa mostra il riepilogo, aperta i giorni e i loro esercizi. Non tiene stato: cosa è
// aperto (`expanded`, `expandedDays` per id di giorno) e cosa fare sui comandi lo decide chi la usa.
const PlanCard = ({
  plan, expanded, expandedDays, limits, isFree,
  onToggle, onToggleDay, onEdit, onDelete, onActivate, onDeleteDay,
  onAddExercise, onEditExercise, onDeleteExercise, onMoveExercise,
}) => {
  const { t } = useTranslation();
  const summary = planCardSummary(plan);

  return (
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
                  bgcolor: 'success.muted',
                  color: 'success.title',
                  fontSize: 13,
                  fontWeight: 700,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: radius.pill,
                }}
              >
                {t('plans.active_badge')}
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <IconButton
            onClick={() => onEdit(plan)}
            aria-label={t('plans.edit_plan.aria', { name: plan.name })}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={() => onDelete(plan)}
            aria-label={t('plans.delete_plan.aria', { name: plan.name })}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {readOnlyOnCard(plan) && (
        <ReadOnlyNotice reason="days_over_limit" limits={limits} isFree={isFree} />
      )}
      {!expanded && summary.splitNames && (
        <Box sx={{ display: 'flex', mb: 0.75, fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
          <FitNames names={summary.splitNames} sepSx={{ color: 'text.secondary' }} />
        </Box>
      )}
      {plan.description && (
        <Typography sx={{ fontSize: 16, color: 'text.secondary', lineHeight: 1.5 }}>
          {plan.description}
        </Typography>
      )}

      {expanded ? (
        <Box sx={{ mt: 2.25, pt: 2.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {plan.days && plan.days.map((day, dayIndex) => {
            const dayExpanded = !!expandedDays[day.id];
            const dayPanelId = `day-details-panel-${day.id}`;
            return (
              <Box key={day.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
                    {day.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => onToggleDay(day.id)}
                      aria-expanded={dayExpanded}
                      aria-controls={dayPanelId}
                      sx={DAY_LINK_SX}
                    >
                      {dayExpanded ? t('plans.hide') : t('plans.details')}
                    </Button>
                    {plan.days.length > 1 && (
                      <IconButton
                        size="small"
                        aria-label={t('plans.delete_day.aria', { name: day.name })}
                        onClick={() => onDeleteDay(day)}
                        sx={{ color: 'text.secondary' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {day.exercises && day.exercises.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {day.exercises.slice(0, MAX_EXERCISE_ROWS).map((exercise) => (
                      <Box key={exercise.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 400, color: 'text.primary', flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                          {exercise.exercise_name}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap', textAlign: 'right',
                            flexShrink: 0, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {planSummaryCompact(exercise.planned_sets)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('plans.no_exercises')}
                  </Typography>
                )}
                {day.exercises && day.exercises.length > MAX_EXERCISE_ROWS && !dayExpanded && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => onToggleDay(day.id)}
                    aria-controls={dayPanelId}
                    sx={{ ...DAY_LINK_SX, mt: 0.75, display: 'flex' }}
                  >
                    {t('plans.more_exercises', { count: day.exercises.length - MAX_EXERCISE_ROWS })}
                  </Button>
                )}

                <Collapse in={dayExpanded} id={dayPanelId} timeout="auto">
                  <Box sx={{
                    mt: 1.25, mb: 1.5, borderRadius: radius.md, p: '12px 14px',
                    bgcolor: 'background.subtle',
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
                                      {t('plans.plan_line', { summary: planSummary(exercise.planned_sets), rest: exercise.rest })}
                                    </Typography>
                                    {exercise.notes && (
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                        {t('plans.notes', { notes: exercise.notes })}
                                      </Typography>
                                    )}
                                  </div>
                                  {!plan.read_only && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <ButtonGroup size="small" sx={{ mr: 1 }}>
                                      <IconButton
                                        size="small"
                                        aria-label={t('plans.move_up.aria', { name: exercise.exercise_name })}
                                        disabled={exerciseGlobalIndex <= 0}
                                        onClick={() => onMoveExercise(day, exercise, 'up')}
                                      >
                                        <ArrowUpwardIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        aria-label={t('plans.move_down.aria', { name: exercise.exercise_name })}
                                        disabled={exerciseGlobalIndex >= day.exercises.length - 1}
                                        onClick={() => onMoveExercise(day, exercise, 'down')}
                                      >
                                        <ArrowDownwardIcon fontSize="small" />
                                      </IconButton>
                                    </ButtonGroup>
                                    <IconButton
                                      size="small"
                                      aria-label={t('plans.edit_exercise.aria', { name: exercise.exercise_name })}
                                      onClick={() => onEditExercise(day.id, exercise)}
                                      sx={{ mr: 1, color: 'text.secondary' }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      aria-label={t('plans.delete_exercise.aria', { name: exercise.exercise_name })}
                                      onClick={() => onDeleteExercise(day.id, exercise)}
                                      sx={{ color: 'text.secondary' }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                  )}
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

                {!plan.read_only && (
                  <Button
                    onClick={() => onAddExercise(dayIndex)}
                    size="small"
                    sx={{ ...DAY_LINK_SX, mt: 1, display: 'flex' }}
                  >
                    {t('plans.add_exercise')}
                  </Button>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography sx={{ mt: 1.75, fontSize: 16, color: 'text.secondary' }}>
          {summary.days === 0
            ? t('plans.no_days')
            : [
              summary.splitNames ? null : t('plans.days_count', { count: summary.days }),
              t('plans.exercises_count', { count: summary.exercises }),
              t('plans.sets_count', { count: summary.sets }),
            ].filter(Boolean).join(' · ')}
        </Typography>
      )}
    </CardContent>
    <CardActions sx={{ px: 3, pb: 2.5, pt: 2, mt: 'auto', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between', gap: 1 }}>
      <Button
        size="small"
        variant="text"
        onClick={() => onToggle()}
        aria-expanded={expanded}
        sx={{ fontSize: 16, fontWeight: 600, textTransform: 'none', color: 'text.secondary', minWidth: 0, p: 0, whiteSpace: 'nowrap' }}
      >
        {expanded ? t('plans.hide_days') : t('plans.show_days')}
      </Button>

      {!plan.is_active && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => onActivate(plan.id)}
          sx={{
            color: 'text.primary', borderColor: 'text.secondary',
            borderRadius: radius.sm, px: 2, py: 1, fontSize: 16, fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap',
            '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          {t('plans.activate')}
        </Button>
      )}
    </CardActions>
  </Card>
  );
};

export default PlanCard;

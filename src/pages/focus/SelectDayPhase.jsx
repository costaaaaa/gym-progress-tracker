import {
  Container, Box, Typography, Button, ButtonBase, Link, Paper, IconButton, Chip
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon, FitnessCenter as FitnessCenterIcon, Timer as TimerIcon, TimerOff as TimerOffIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { muscleLabel } from '../../i18n/labels';
import { planSummary } from '../../utils/plannedSets';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import LogoMark from '../../components/LogoMark';
import { radius } from '../../theme/radius';
import { choiceSx } from './choiceSx';

export default function SelectDayPhase({
  activePlan, selectedDayId, selectedDay, timerEnabled, onDayChange, onStart, onBack, onGoToPlans
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  // Frecce come in un gruppo di opzioni: scelgono il giorno accanto (con giro) e gli portano il fuoco
  const moveDay = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const options = [...event.currentTarget.querySelectorAll('[role="radio"]')];
    const from = options.indexOf(event.target);
    if (!step || from < 0) return;
    event.preventDefault();
    const next = (from + step + options.length) % options.length;
    onDayChange(activePlan.days[next].id);
    options[next].focus();
  };
  const hasSelected = Boolean(activePlan?.days?.some((d) => d.id === selectedDayId));
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text }}>
      <Box sx={{
        px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.25,
        borderBottom: `1px solid ${colors.border}`
      }}>
        <IconButton onClick={onBack} aria-label={t('common.back')} sx={{ color: colors.text }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{
          width: 26, height: 26, borderRadius: '7px', bgcolor: colors.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <LogoMark width={15} color={colors.primaryContrast} />
        </Box>
        <Typography component="h1" tabIndex={-1} sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 14 }}>
          {t('focus.title')}
        </Typography>
      </Box>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        {!activePlan ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FitnessCenterIcon sx={{ fontSize: 64, color: colors.textSecondary, mb: 2 }} />
            <Typography variant="h6" component="h2" sx={{ color: colors.textSecondary, mb: 2 }}>
              {t('focus.no_plan')}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
              {t('focus.no_plan_hint')}
            </Typography>
            <Button
              variant="outlined"
              onClick={onGoToPlans}
              sx={{ color: colors.primaryText, borderColor: colors.primary }}
            >
              {t('focus.go_plans')}
            </Button>
          </Box>
        ) : (
          <>
            <Paper sx={{
              bgcolor: colors.bgCard, p: 3, mb: 3,
              border: `1px solid ${colors.border}`
            }}>
              <Typography variant="subtitle2" component="p" sx={{ color: colors.textSecondary }}>
                {t('focus.active_plan')}
              </Typography>
              <Typography variant="h5" component="h2" sx={{ color: colors.text, fontWeight: 700, mb: 3 }}>
                {activePlan.name}
              </Typography>

              <Box role="radiogroup" aria-label={t('record.select_day')} onKeyDown={moveDay}
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {activePlan.days?.map((day, index) => {
                  const selected = day.id === selectedDayId;
                  return (
                    <ButtonBase key={day.id} role="radio" aria-checked={selected}
                      // Una sola etichetta è nell'ordine di Tab (la scelta, o la prima se nessun giorno della scheda è scelto); le frecce spostano scelta e fuoco
                      tabIndex={selected || (!hasSelected && index === 0) ? 0 : -1}
                      onClick={() => onDayChange(day.id)}
                      sx={{
                        minHeight: 44, px: 2, borderRadius: radius.pill, fontSize: '0.95rem', ...choiceSx(colors, selected),
                      }}>
                      {day.name}
                    </ButtonBase>
                  );
                })}
              </Box>

              {selectedDay && selectedDay.exercises && (
                <Box>
                  <Typography variant="subtitle2" component="h3" sx={{ color: colors.textSecondary, mb: 1.5 }}>
                    {t('focus.exercises_header', { count: selectedDay.exercises.length })}
                  </Typography>
                  {selectedDay.exercises.map((ex, idx) => (
                    <Box key={ex.id} sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      py: 1.5, borderBottom: idx < selectedDay.exercises.length - 1 ? `1px solid ${colors.border}` : 'none'
                    }}>
                      <Box>
                        <Typography variant="body1" sx={{ color: colors.text, fontWeight: 500 }}>
                          {ex.exercise_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                          {t('plans.plan_line', { summary: planSummary(ex.planned_sets), rest: ex.rest })}
                        </Typography>
                      </Box>
                      <Chip
                        label={muscleLabel(ex.muscle_group)}
                        size="small"
                        sx={{
                          bgcolor: colors.bgElevated,
                          color: colors.textSecondary,
                          fontWeight: 500,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<PlayArrowIcon />}
              disabled={!selectedDay || !selectedDay.exercises || selectedDay.exercises.length === 0}
              onClick={onStart}
              sx={{
                py: 2, fontSize: '1.2rem', fontWeight: 700,
                bgcolor: colors.primary, color: colors.primaryContrast, borderRadius: radius.lg,
                '&:hover': { bgcolor: colors.primaryDark },
                '&:disabled': { bgcolor: colors.bgElevated, color: colors.textSecondary },
              }}
            >
              {t('focus.start')}
            </Button>

            {selectedDay && selectedDay.exercises?.length === 0 && (
              <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', mt: 1.5 }}>
                {t('focus.day_empty')}{' '}
                <Link component="button" type="button" onClick={onGoToPlans} sx={{ verticalAlign: 'baseline', color: colors.primaryText }}>
                  {t('focus.day_empty_link')}
                </Link>
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2, gap: 1 }}>
              {timerEnabled ? (
                <>
                  <TimerIcon sx={{ fontSize: 16, color: colors.success }} />
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>{t('focus.timer_on')}</Typography>
                </>
              ) : (
                <>
                  <TimerOffIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>{t('focus.timer_off')}</Typography>
                </>
              )}
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}

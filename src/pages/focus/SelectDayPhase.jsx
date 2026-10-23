import {
  Container, Box, Typography, Button, FormControl, InputLabel, Select, MenuItem, Paper, IconButton, Chip
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon, FitnessCenter as FitnessCenterIcon, Timer as TimerIcon, TimerOff as TimerOffIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { muscleLabel, techniqueLabel } from '../../i18n/labels';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

export default function SelectDayPhase({
  activePlan, selectedDayId, selectedDay, timerEnabled, onDayChange, onStart, onBack, onGoToPlans
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text }}>
      <Box sx={{
        px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.25,
        borderBottom: `1px solid ${colors.border}`
      }}>
        <IconButton onClick={onBack} sx={{ color: colors.text }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{
          width: 26, height: 26, borderRadius: '7px', bgcolor: colors.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FitnessCenterIcon sx={{ color: colors.primaryContrast, fontSize: 15 }} />
        </Box>
        <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 14 }}>
          Focus mode
        </Typography>
      </Box>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        {!activePlan ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FitnessCenterIcon sx={{ fontSize: 64, color: colors.textMuted, mb: 2 }} />
            <Typography variant="h6" sx={{ color: colors.textSecondary, mb: 2 }}>
              {t('focus.no_plan')}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, mb: 3 }}>
              {t('focus.no_plan_hint')}
            </Typography>
            <Button
              variant="outlined"
              onClick={onGoToPlans}
              sx={{ color: colors.primary, borderColor: colors.primary }}
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
              <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>
                {t('focus.active_plan')}
              </Typography>
              <Typography variant="h5" sx={{ color: colors.text, fontWeight: 700, mb: 3 }}>
                {activePlan.name}
              </Typography>

              <FormControl fullWidth sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  color: colors.text,
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.primary },
                  '&.Mui-focused fieldset': { borderColor: colors.primary },
                },
                '& .MuiInputLabel-root': { color: colors.textSecondary },
                '& .MuiInputLabel-root.Mui-focused': { color: colors.primary },
                '& .MuiSvgIcon-root': { color: colors.textSecondary },
              }}>
                <InputLabel>{t('record.select_day')}</InputLabel>
                <Select
                  value={selectedDayId}
                  label={t('record.select_day')}
                  onChange={onDayChange}
                >
                  {activePlan.days?.map((day) => (
                    <MenuItem key={day.id} value={day.id}>{day.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedDay && selectedDay.exercises && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: colors.textSecondary, mb: 1.5 }}>
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
                        <Typography variant="caption" sx={{ color: colors.textMuted }}>
                          {t('focus.plan_line', { sets: ex.sets, reps: ex.reps, rest: ex.rest })}
                          {ex.intensity_technique && ` — ${techniqueLabel(ex.intensity_technique)}`}
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
                bgcolor: colors.primary, color: colors.primaryContrast, borderRadius: '12px',
                '&:hover': { bgcolor: colors.primaryDark },
                '&:disabled': { bgcolor: colors.bgElevated, color: colors.textMuted },
              }}
            >
              {t('focus.start')}
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2, gap: 1 }}>
              {timerEnabled ? (
                <>
                  <TimerIcon sx={{ fontSize: 16, color: colors.success }} />
                  <Typography variant="caption" sx={{ color: colors.textMuted }}>{t('focus.timer_on')}</Typography>
                </>
              ) : (
                <>
                  <TimerOffIcon sx={{ fontSize: 16, color: colors.textMuted }} />
                  <Typography variant="caption" sx={{ color: colors.textMuted }}>{t('focus.timer_off')}</Typography>
                </>
              )}
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}

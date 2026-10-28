import {
  Container, Box, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem, Paper, LinearProgress,
  IconButton, Chip, Alert, Dialog, DialogTitle, DialogActions, Fade
} from '@mui/material';
import {
  SkipNext as SkipNextIcon, Check as CheckIcon, Close as CloseIcon, Info as InfoIcon, AccessTime as AccessTimeIcon,
  History as HistoryIcon, SwapHoriz as SwapIcon, Add as AddIcon, Lock as LockIcon, Remove as RemoveIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { TABULAR } from '../../utils/fonts';
import ElapsedClock from './ElapsedClock';
import QuitDialog from './QuitDialog';
import { INTENSITY_TECHNIQUES } from '../../components/ExerciseDialog';
import { MAX_WEIGHT, isValidWeight, isValidReps, planRepsForSet, lastSessionSets, setStatus } from '../../utils/focusSession';
import { muscleLabel, techniqueLabel } from '../../i18n/labels';

export default function WorkoutPhase({
  currentExercise, currentExerciseIndex, totalExercises, currentSetIndex, totalSetsForCurrentExercise,
  currentExerciseSets, currentSkippedSets, lastSession, exerciseTransition, clockStart, clockEnd,
  weightInput, onWeightChange, repsInput, onRepsChange, intensityTechniqueInput, onIntensityChange,
  onConfirmSet, onSkipSet, onSkipExercise, canEditSession, onOpenPicker, onQuit,
  quitDialogOpen, onCloseQuitDialog, onConfirmQuit, totalCompletedSets,
  repsConfirmOpen, onCloseRepsConfirm, onConfirmReps
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}` }}>
        <IconButton onClick={onQuit} sx={{ color: colors.textSecondary }}><CloseIcon /></IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
          <Typography variant="caption" sx={{ ...TABULAR, color: colors.textSecondary }}><ElapsedClock startTime={clockStart} endTime={clockEnd} /></Typography>
        </Box>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>{currentExerciseIndex + 1}/{totalExercises}</Typography>
      </Box>

      <LinearProgress variant="determinate" value={((currentExerciseIndex) / totalExercises) * 100}
        sx={{ height: 3, bgcolor: colors.border, '& .MuiLinearProgress-bar': { bgcolor: colors.text } }} />

      <Fade in={exerciseTransition} timeout={300}>
        <Container maxWidth="sm" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Chip label={muscleLabel(currentExercise.muscle_group)} size="small" sx={{ bgcolor: colors.bgElevated, color: colors.textSecondary, mb: 1, fontWeight: 500 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>{currentExercise.exercise_name}</Typography>
            {currentExercise.notes && (
              <Alert severity="info" icon={<InfoIcon />}
                sx={{ mt: 2, bgcolor: colors.bgElevated, color: colors.textSecondary, '& .MuiAlert-icon': { color: colors.textSecondary }, border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
                {currentExercise.notes}
              </Alert>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 3 }}>
            {Array.from({ length: Number(totalSetsForCurrentExercise) || 0 }, (_, idx) => {
              const status = setStatus(idx, currentSetIndex, currentSkippedSets);
              return (
                <Box key={idx} title={status === 'skipped' ? t('focus.set_skipped') : undefined} sx={{
                  width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px ${status === 'skipped' ? 'dashed' : 'solid'} ${status === 'done' ? colors.success : status === 'active' ? colors.text : colors.border}`,
                  bgcolor: status === 'done' ? colors.success : status === 'skipped' ? colors.bgElevated : 'transparent',
                  color: status === 'done' ? '#fff' : status === 'active' ? colors.text : colors.textSecondary,
                  fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.3s ease'
                }}>
                  {status === 'done' ? <CheckIcon sx={{ fontSize: 18 }} /> : status === 'skipped' ? <RemoveIcon sx={{ fontSize: 18 }} /> : idx + 1}
                </Box>
              );
            })}
          </Box>

          <Typography variant="subtitle2" sx={{ textAlign: 'center', color: colors.textSecondary, mb: 3 }}>
            {t('focus.set_of', { n: currentSetIndex + 1, total: totalSetsForCurrentExercise })}
          </Typography>

          {(() => {
            const lastSets = lastSessionSets(lastSession);
            if (lastSets.length === 0) return null;
            return (
              <Box sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2, px: 1.5, py: 1,
                borderRadius: '10px', bgcolor: colors.bgElevated, border: `1px solid ${colors.border}`
              }}>
                <HistoryIcon sx={{ fontSize: 18, color: colors.textSecondary, mt: 0.25 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    {t('focus.last_time')}
                  </Typography>
                  {/* Una chip per serie, con la tecnica sotto; evidenziata quella pari alla serie in corso */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                    {lastSets.map((set, idx) => {
                      const isCurrent = idx === currentSetIndex;
                      return (
                        <Box key={idx} sx={{
                          px: 1, py: 0.5, borderRadius: '6px', bgcolor: colors.bgCard,
                          border: `1px solid ${isCurrent ? colors.text : colors.border}`,
                        }}>
                          <Typography variant="body2" sx={{ color: isCurrent ? colors.text : colors.textSecondary, fontWeight: isCurrent ? 700 : 600, lineHeight: 1.3 }}>
                            {set.label}
                          </Typography>
                          {set.technique && (
                            <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', lineHeight: 1.2, fontWeight: 600 }}>
                              {techniqueLabel(set.technique)}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            );
          })()}

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label={t('record.weight')} type="number" value={weightInput} onChange={(e) => onWeightChange(e.target.value)}
              fullWidth autoFocus inputProps={{ step: 0.5, min: 0, max: MAX_WEIGHT, inputMode: 'decimal' }}
              sx={{ '& .MuiOutlinedInput-root': { color: colors.text, fontSize: '1.2rem', fontWeight: 700, '& fieldset': { borderColor: colors.border, borderWidth: 2 }, '&:hover fieldset': { borderColor: colors.text }, '&.Mui-focused fieldset': { borderColor: colors.text } }, '& .MuiInputLabel-root': { color: colors.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: colors.text } }} />
            {/* Vuoto a ogni serie: la scheda in grigio è solo un suggerimento, va scritta */}
            <TextField label={t('record.reps')} value={repsInput} onChange={(e) => onRepsChange(e.target.value)}
              placeholder={planRepsForSet(currentExercise.reps, currentSetIndex)} InputLabelProps={{ shrink: true }}
              onFocus={(e) => e.target.select()}
              fullWidth inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              sx={{ '& .MuiOutlinedInput-root': { color: colors.text, fontSize: '1.2rem', fontWeight: 700, '& fieldset': { borderColor: colors.border, borderWidth: 2 }, '&:hover fieldset': { borderColor: colors.text }, '&.Mui-focused fieldset': { borderColor: colors.text } }, '& .MuiInputLabel-root': { color: colors.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: colors.text } }} />
          </Box>

          <FormControl fullWidth sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              color: colors.text,
              '& fieldset': { borderColor: colors.border, borderWidth: 2 },
              '&:hover fieldset': { borderColor: colors.text },
              '&.Mui-focused fieldset': { borderColor: colors.text },
            },
            '& .MuiInputLabel-root': { color: colors.textSecondary },
            '& .MuiInputLabel-root.Mui-focused': { color: colors.text },
            '& .MuiSvgIcon-root': { color: colors.textSecondary },
          }}>
            <InputLabel>{t('focus.technique')}</InputLabel>
            <Select
              value={intensityTechniqueInput}
              label={t('focus.technique')}
              onChange={(e) => onIntensityChange(e.target.value)}
            >
              <MenuItem value=""><em>{t('record.no_technique')}</em></MenuItem>
              {INTENSITY_TECHNIQUES.filter(tech => tech !== 'Nessuna (Normale)').map((tech) => (
                <MenuItem key={tech} value={tech}>{techniqueLabel(tech)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" fullWidth size="large" startIcon={<CheckIcon />} onClick={onConfirmSet} disabled={!isValidWeight(weightInput) || !isValidReps(repsInput)}
            sx={{ py: 2.5, fontSize: '1.2rem', fontWeight: 700, letterSpacing: 1, bgcolor: colors.success, color: '#fff', borderRadius: '14px',
              boxShadow: 'none', '&:hover': { bgcolor: 'success.dark', boxShadow: 'none' },
              '&:disabled': { bgcolor: colors.bgElevated, color: colors.textSecondary }, mb: 2, transition: 'all 0.3s ease' }}>
            {t('focus.confirm_set')}
          </Button>

          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            {/* Dalla seconda serie: saltare la prima equivale a saltare l'esercizio */}
            {currentSetIndex > 0 && (
              <Button variant="text" fullWidth startIcon={<SkipNextIcon />} onClick={onSkipSet}
                sx={{ py: 1.5, color: colors.textSecondary, '&:hover': { color: colors.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                {t('focus.skip_set')}
              </Button>
            )}
            <Button variant="text" fullWidth startIcon={<SkipNextIcon />} onClick={onSkipExercise}
              sx={{ py: 1.5, color: colors.textSecondary, '&:hover': { color: colors.text, bgcolor: 'rgba(255,255,255,0.05)' } }}>
              {t('focus.skip_exercise')}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            {[
              { mode: 'swap', label: t('focus.swap_exercise'), icon: <SwapIcon /> },
              { mode: 'add', label: t('focus.add_exercise'), icon: <AddIcon /> },
            ].map(({ mode: pickerMode, label, icon }) => (
              <Button key={pickerMode} variant="outlined" fullWidth startIcon={icon}
                endIcon={canEditSession ? null : <LockIcon sx={{ fontSize: '16px !important' }} />}
                onClick={() => onOpenPicker(pickerMode)}
                sx={{ py: 1.25, opacity: pickerMode === 'swap' && currentSetIndex > 0 ? 0.45 : 1, color: colors.textSecondary, borderColor: colors.border, borderRadius: '12px',
                  '&:hover': { borderColor: colors.text, color: colors.text } }}>
                {label}
              </Button>
            ))}
          </Box>

          {currentExerciseSets.length > 0 && (
            <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: colors.bgElevated }}>
                <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>{t('focus.sets_done')}</Typography>
              </Box>
              {currentExerciseSets.map((set, idx) => (
                <Box key={set.setNumber} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  px: 2, py: 1.25, borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none',
                }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>{t('focus.set_n', { n: set.setNumber })}</Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ color: colors.text, fontWeight: 600 }}>{set.weight} kg × {set.reps}</Typography>
                    {set.intensity_technique && (
                      <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>{techniqueLabel(set.intensity_technique)}</Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Paper>
          )}
        </Container>
      </Fade>

      <QuitDialog open={quitDialogOpen} onClose={onCloseQuitDialog} onConfirm={onConfirmQuit}
        title={t('focus.quit_title')} text={t('focus.quit_text', { count: totalCompletedSets })}
        stayLabel={t('focus.quit_continue')} exitLabel={t('focus.quit_exit')} destructive />

      <Dialog open={repsConfirmOpen} onClose={onCloseRepsConfirm}
        PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: '16px' } }}>
        <DialogTitle sx={{ color: colors.text }}>{t('record.confirm_reps', { reps: parseInt(repsInput, 10) })}</DialogTitle>
        <DialogActions>
          <Button onClick={onCloseRepsConfirm} sx={{ color: colors.textSecondary }}>{t('record.fix')}</Button>
          <Button onClick={onConfirmReps} sx={{ color: colors.text }}>{t('record.confirm_yes')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

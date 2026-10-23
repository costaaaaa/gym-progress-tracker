import {
  Container, Box, Typography, Button, TextField, Paper, CircularProgress, IconButton, Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Save as SaveIcon, EmojiEvents as TrophyIcon, TrendingUp as TrendingUpIcon,
  Share as ShareIcon, LocalFireDepartment as FireIcon, Add as AddIcon, Lock as LockIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { TABULAR } from '../../utils/tabularFont';
import QuitDialog from './QuitDialog';
import { detectPersonalRecords } from '../../utils/workoutMetrics';
import { buildShareStats, sessionRecords } from '../../utils/shareCard';
import ShareCardDialog from '../../components/ShareCardDialog';
import { track } from '../../utils/analytics';
import { techniqueLabel } from '../../i18n/labels';

const XP_WITHHELD_KEYS = {
  incomplete: 'focus.xp_incomplete',
  too_short: 'focus.xp_too_short',
  cooldown: 'focus.xp_cooldown',
  no_plan: 'focus.xp_no_plan'
};

export default function SummaryPhase({
  activePlan, selectedDay, completedSets, historyIndex, startTime, elapsedSeconds, elapsedTime, totalCompletedSets,
  workoutNotes, onNotesChange, saving, savedResult, onSave, onQuit, onGoHistory, onGoHome,
  canEditSession, onAddExercise, shareStats, onOpenShare, onCloseShare,
  quitDialogOpen, onCloseQuitDialog, onConfirmQuit
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();

  const xpWithheldText = (result) => {
    if (!result || result.xp_session_awarded !== false) return '';
    const key = XP_WITHHELD_KEYS[result.xp_session_reason];
    return key ? t(key, { pct: result.completion_pct ?? 0 }) : '';
  };
  const totalSets = totalCompletedSets;
  const exercisesCompleted = Object.keys(completedSets).length;
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${colors.border}` }}>
        <IconButton onClick={onQuit} sx={{ color: colors.textSecondary }}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('focus.summary')}</Typography>
      </Box>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <TrophyIcon sx={{ fontSize: 56, color: colors.warning, mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('focus.completed')}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text }}>{exercisesCompleted}</Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>{t('focus.exercises')}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text }}>{totalSets}</Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>{t('focus.sets')}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ ...TABULAR, fontWeight: 700, color: colors.text }}>{elapsedTime}</Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>{t('focus.duration')}</Typography>
            </Box>
          </Box>
        </Box>

        <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', mb: 3, border: `1px solid ${colors.border}` }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: colors.bgElevated }}>
            <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>{t('focus.detail')}</Typography>
          </Box>
          {selectedDay?.exercises?.map((exercise) => {
            const sets = completedSets[exercise.id];
            if (!sets || sets.length === 0) return null;
            // Confronto con lo storico PRIMA di questa sessione → record personali
            const pr = detectPersonalRecords(sets, historyIndex[exercise.exercise_id]);
            const prParts = [];
            if (pr.weight) prParts.push(t('focus.pr_weight'));
            if (pr.oneRM) prParts.push(t('focus.pr_1rm'));
            if (pr.reps) prParts.push(t('focus.pr_reps'));
            return (
              <Box key={exercise.id} sx={{ px: 2, py: 2, borderBottom: `1px solid ${colors.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: colors.text }}>{exercise.exercise_name}</Typography>
                  {exercise.replaces && (
                    <Typography variant="caption" sx={{ color: colors.textMuted }}>{t('focus.replaces', { name: exercise.replaces })}</Typography>
                  )}
                  {pr.isPR && (
                    <Chip
                      icon={<TrophyIcon sx={{ fontSize: 16, color: `${colors.warning} !important` }} />}
                      label={prParts.length ? t('focus.new_record_parts', { parts: prParts.join(', ') }) : t('focus.new_record')}
                      size="small"
                      sx={{ bgcolor: 'rgba(255, 167, 38, 0.15)', color: colors.warning, fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  )}
                  {!!pr.volume && (
                    <Chip
                      icon={<TrendingUpIcon sx={{ fontSize: 16, color: `${colors.textSecondary} !important` }} />}
                      label={t('focus.best_volume')}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: colors.border, color: colors.textSecondary, fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {sets.map((set) => (
                    <Box key={set.setNumber} sx={{
                      bgcolor: colors.bgElevated, borderRadius: '6px', px: 1.125, py: 0.625,
                      fontSize: 12, fontWeight: 600, color: colors.textSecondary,
                    }}>
                      {set.weight}kg×{set.reps}{set.intensity_technique ? ` · ${techniqueLabel(set.intensity_technique)}` : ''}
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Paper>

        {savedResult ? (
          <>
            {/* Streak banner */}
            {(savedResult.week_completed_now || savedResult.streak_milestone || savedResult.new_longest) && (
              <Paper sx={{
                bgcolor: colors.bgElevated,
                border: `1px solid ${colors.border}`,
                p: 2.5, mb: 3, textAlign: 'center'
              }}>
                <FireIcon sx={{ fontSize: 40, color: colors.warning, mb: 0.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: colors.text }}>
                  {savedResult.new_longest
                    ? t('focus.streak_new_longest', { weeks: savedResult.current_streak_weeks })
                    : savedResult.streak_milestone && savedResult.current_streak_weeks > 1
                      ? t('focus.streak_milestone', { weeks: savedResult.current_streak_weeks })
                      : t('focus.week_completed')}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                  {t('focus.streak_line', { count: savedResult.current_streak_weeks })}
                </Typography>
              </Paper>
            )}

            {xpWithheldText(savedResult) && (
              <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', mb: 2 }}>
                {xpWithheldText(savedResult)}
              </Typography>
            )}

            {/* Recap card */}
            {(() => {
              const prs = (selectedDay?.exercises || [])
                .filter(ex => completedSets[ex.id]?.length)
                .map(ex => ({ name: ex.exercise_name, pr: detectPersonalRecords(completedSets[ex.id], historyIndex[ex.exercise_id]) }));
              const prList = prs.filter(x => x.pr.isPR).map(x => x.name);
              const volumeList = prs.filter(x => x.pr.volume).map(x => x.name);

              const cardExercises = (selectedDay?.exercises || []).map(ex => ({
                exercise_id: ex.exercise_id,
                name: ex.exercise_name,
                muscle_group: ex.muscle_group,
                sets: completedSets[ex.id] || [],
              }));

              const handleShare = () => {
                onOpenShare(buildShareStats({
                  exercises: cardExercises,
                  date: startTime || new Date(),
                  durationSec: elapsedSeconds,
                  title: `${activePlan?.name || ''}${selectedDay?.name ? ' · ' + selectedDay.name : ''}`,
                  records: sessionRecords(cardExercises, historyIndex),
                  streakWeeks: savedResult.current_streak_weeks,
                }));
                track('workout_card', { action: 'open', from: 'summary' });
              };

              return (
                <Paper sx={{ bgcolor: colors.bgCard, border: `1px solid ${colors.border}`, p: 2.5, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: colors.textSecondary, mb: 1.5 }}>
                    {t('focus.session_summary')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                    {activePlan?.name}{selectedDay?.name ? ` · ${selectedDay.name}` : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                    ⏱ {elapsedTime} · {t('focus.exercises_count', { count: exercisesCompleted })} · {t('focus.sets_count', { count: totalSets })}
                  </Typography>
                  {prList.length > 0 && (
                    <Typography variant="body2" sx={{ color: colors.warning, mb: 0.5 }}>
                      {t('focus.new_records', { list: prList.join(', ') })}
                    </Typography>
                  )}
                  {volumeList.length > 0 && (
                    <Typography variant="body2" sx={{ color: colors.text, mb: 0.5 }}>
                      {t('focus.best_volume_list', { list: volumeList.join(', ') })}
                    </Typography>
                  )}
                  {savedResult.current_streak_weeks > 0 && (
                    <Typography variant="body2" sx={{ color: colors.text }}>
                      🔥 {t('focus.streak_line_plain', { count: savedResult.current_streak_weeks })}
                    </Typography>
                  )}
                  <Button
                    variant="outlined" fullWidth size="small"
                    startIcon={<ShareIcon />}
                    onClick={handleShare}
                    sx={{ mt: 2, borderColor: colors.border, color: colors.textSecondary }}
                  >
                    {t('focus.share')}
                  </Button>
                </Paper>
              );
            })()}

            <Button
              variant="contained" fullWidth size="large"
              onClick={onGoHistory}
              sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, bgcolor: colors.primary, color: colors.primaryContrast, borderRadius: '12px', mb: 2 }}
            >
              {t('focus.go_history')}
            </Button>

            <Button variant="text" fullWidth onClick={onGoHome} sx={{ color: colors.textMuted, py: 1.5 }}>
              {t('focus.go_home')}
            </Button>

            <ShareCardDialog open={!!shareStats} stats={shareStats} onClose={onCloseShare} />
          </>
        ) : (
          <>
            {/* Esercizio dimenticato: si aggiunge in coda e si torna ad allenarsi */}
            <Button variant="outlined" fullWidth startIcon={<AddIcon />}
              endIcon={canEditSession ? null : <LockIcon sx={{ fontSize: '16px !important' }} />}
              onClick={onAddExercise}
              sx={{ py: 1.25, mb: 3, color: colors.textSecondary, borderColor: colors.border, borderRadius: '12px',
                '&:hover': { borderColor: colors.text, color: colors.text } }}>
              {t('focus.add_exercise')}
            </Button>

            <TextField label={t('focus.notes_label')} multiline rows={3} value={workoutNotes}
              onChange={(e) => onNotesChange(e.target.value)} fullWidth placeholder={t('focus.notes_placeholder')}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: colors.text, '& fieldset': { borderColor: colors.border }, '&:hover fieldset': { borderColor: colors.primary }, '&.Mui-focused fieldset': { borderColor: colors.primary } }, '& .MuiInputLabel-root': { color: colors.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: colors.primary } }} />

            <Button variant="contained" fullWidth size="large"
              startIcon={saving ? <CircularProgress size={20} sx={{ color: colors.primaryContrast }} /> : <SaveIcon />}
              onClick={onSave} disabled={saving || totalCompletedSets === 0}
              sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, bgcolor: colors.primary, color: colors.primaryContrast, borderRadius: '12px',
                '&:hover': { bgcolor: colors.primaryDark },
                '&:disabled': { bgcolor: colors.bgElevated, color: colors.textMuted }, mb: 2 }}>
              {saving ? t('focus.saving') : t('focus.save')}
            </Button>

            <Button variant="text" fullWidth onClick={onQuit} disabled={saving} sx={{ color: colors.textMuted, py: 1.5 }}>{t('common.cancel')}</Button>
          </>
        )}
      </Container>

      <QuitDialog open={quitDialogOpen} onClose={onCloseQuitDialog} onConfirm={onConfirmQuit}
        title={t('focus.discard_title')} text={t('focus.discard_text', { count: totalCompletedSets })}
        stayLabel={t('focus.discard_stay')} exitLabel={t('focus.discard_exit')} />
    </Box>
  );
}

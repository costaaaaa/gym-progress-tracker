import { Fragment, useId, useState } from 'react';
import {
  Container, Box, Typography, Button, ButtonBase, TextField, Paper, IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Save as SaveIcon, EmojiEvents as TrophyIcon,
  Share as ShareIcon, LocalFireDepartment as FireIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { TABULAR } from '../../utils/fonts';
import QuitDialog from './QuitDialog';
import { isWorkingSet } from '../../utils/workoutMetrics';
import { buildShareStats, sessionRecords } from '../../utils/shareCard';
import ShareCardDialog from '../../components/ShareCardDialog';
import WarmupBadge from '../../components/WarmupBadge';
import { track } from '../../utils/analytics';
import { techniqueLabel } from '../../i18n/labels';
import { formatSetText } from '../../i18n/format';
import { radius } from '../../theme/radius';
import SetsDoneDialog from './SetsDoneDialog';
import { slotLabel } from './slotLabel';
import { setSlot } from '../../utils/focusSession';
import ButtonSpinner from '../../components/ButtonSpinner';
import { useModule } from '../../hooks/useModule';
import { levelReachedText, achievementsText } from './rewardTexts';

// Cosa si è battuto, per tipo di record: il miglior volume non ha una serie da mostrare
const RECORD_KEYS = {
  weight: 'focus.record.weight',
  oneRM: 'focus.record.oneRM',
  reps: 'focus.record.reps'
};

const XP_WITHHELD_KEYS = {
  incomplete: 'focus.xp_incomplete',
  too_short: 'focus.xp_too_short',
  cooldown: 'focus.xp_cooldown',
  no_plan: 'focus.xp_no_plan'
};

// Numero grande con la sua etichetta: il gruppo prende il nome dall'etichetta già visibile
function SummaryStat({ value, label, valueSx }) {
  const { colors } = useFocusColors();
  const labelId = useId();
  return (
    <Box role="group" aria-labelledby={labelId} sx={{ textAlign: 'center' }}>
      <Typography variant="h4" component="div" sx={{ ...valueSx, fontWeight: 700, color: colors.text }}>{value}</Typography>
      <Typography id={labelId} variant="caption" sx={{ color: colors.textSecondary }}>{label}</Typography>
    </Box>
  );
}

export default function SummaryPhase({
  weightUnit, activePlan, selectedDay, completedSets, historyIndex, shareDate, elapsedSeconds, elapsedTime, totalCompletedSets,
  workoutNotes, onNotesChange, saving, savedResult, onSave, onQuit, onGoHome,
  techniqueOn, onEditSet, shareStats, onOpenShare, onCloseShare,
  quitDialogOpen, onCloseQuitDialog, onConfirmQuit
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  // Senza il modulo Livelli il server conta comunque punti e streak: qui non si mostrano
  const levelsOn = useModule('levels');
  // Serie in correzione: la finestra resta con l'ultimo esercizio mentre si chiude
  const [correction, setCorrection] = useState({ open: false, exercise: null, setNumber: null });

  const xpWithheldText = (result) => {
    if (!levelsOn || !result || result.xp_session_awarded !== false) return '';
    const key = XP_WITHHELD_KEYS[result.xp_session_reason];
    return key ? t(key, { pct: result.completion_pct ?? 0 }) : '';
  };
  // Il riscaldamento non conta fra le serie del riepilogo (totalCompletedSets le conta tutte: serve a salvare e a uscire)
  const totalSets = Object.values(completedSets).flat().filter(isWorkingSet).length;
  // Un esercizio con soli riscaldamenti fatti non è un esercizio completato
  const exercisesCompleted = Object.values(completedSets).filter((sets) => sets.some(isWorkingSet)).length;
  // Gli stessi esercizi vanno ai record di oggi e alla card da condividere
  const cardExercises = (selectedDay?.exercises || []).map((ex) => ({
    exercise_id: ex.exercise_id,
    name: ex.exercise_name,
    muscle_group: ex.muscle_group,
    sets: completedSets[ex.id] || [],
  }));
  const records = sessionRecords(cardExercises, historyIndex);

  const handleShare = () => {
    onOpenShare(buildShareStats({
      exercises: cardExercises,
      date: shareDate || new Date(),
      durationSec: elapsedSeconds,
      title: `${activePlan?.name || ''}${selectedDay?.name ? ' · ' + selectedDay.name : ''}`,
      records,
      streakWeeks: levelsOn ? savedResult.current_streak_weeks : undefined,
    }));
    track('workout_card', { action: 'open', from: 'summary' });
  };

  // Dopo il salvataggio, solo con il modulo Livelli: ogni riga c'è solo se la risposta ha il suo dato
  const rewardRows = [];
  if (savedResult && levelsOn) {
    const r = savedResult;
    if (r.week_completed_now || r.streak_milestone || r.new_longest) {
      rewardRows.push({
        key: 'celebration', celebration: true,
        text: r.new_longest
          ? t('focus.streak_new_longest', { count: r.current_streak_weeks })
          : r.streak_milestone && r.current_streak_weeks > 1
            ? t('focus.streak_milestone', { weeks: r.current_streak_weeks })
            : t('focus.week_completed')
      });
    }
    if (r.current_streak_weeks > 0) rewardRows.push({ key: 'streak', text: t('focus.streak_line', { count: r.current_streak_weeks }) });
    const level = levelReachedText(t, r) || (r.level != null ? t('focus.level_now', { level: r.level }) : '');
    if (level) rewardRows.push({ key: 'level', text: r.xp_gained > 0 ? `${level} · ${t('focus.points_gained', { count: r.xp_gained })}` : level });
    const withheld = xpWithheldText(r);
    if (withheld) rewardRows.push({ key: 'withheld', text: withheld, muted: true });
    const achievements = achievementsText(t, r, weightUnit);
    if (achievements) rewardRows.push({ key: 'achievements', text: achievements });
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${colors.border}` }}>
        <IconButton onClick={onQuit} aria-label={t('focus.quit_aria')} sx={{ color: colors.textSecondary }}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" component="h1" tabIndex={-1} sx={{ fontWeight: 700 }}>{t('focus.summary')}</Typography>
      </Box>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>{t('focus.completed')}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
            <SummaryStat value={exercisesCompleted} label={t('focus.exercises')} />
            <SummaryStat value={totalSets} label={t('focus.sets')} />
            <SummaryStat value={elapsedTime} label={t('focus.duration')} valueSx={TABULAR} />
          </Box>
        </Box>

        {records.length > 0 && (
          <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', mb: 3, border: `1px solid ${colors.border}` }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" component="h2" sx={{ color: colors.textSecondary }}>{t('focus.records_today')}</Typography>
            </Box>
            <Box component="ul" role="list" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {records.map((record, i) => (
                <Box component="li" key={i} sx={{ px: 2, py: 1.5, borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1 }}>
                  <TrophyIcon aria-hidden="true" sx={{ fontSize: 18, color: colors.warningText, alignSelf: 'center' }} />
                  <Typography component="span" sx={{ fontWeight: 600, color: colors.text, minWidth: 0, overflowWrap: 'anywhere' }}>{record.name}</Typography>
                  {' '}
                  <Typography component="span" variant="body2" sx={{ color: colors.textSecondary, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {record.type === 'volume' ? t('focus.best_volume') : t(RECORD_KEYS[record.type], { set: formatSetText(record.weight, record.reps, weightUnit), reps: record.reps })}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', mb: 3, border: `1px solid ${colors.border}` }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" component="h2" sx={{ color: colors.textSecondary }}>{t('focus.detail')}</Typography>
            {!savedResult && (
              <Typography variant="caption" component="p" sx={{ color: colors.textSecondary, m: 0 }}>{t('focus.done_sets.help')}</Typography>
            )}
          </Box>
          {selectedDay?.exercises?.map((exercise) => {
            const sets = completedSets[exercise.id];
            if (!sets || sets.length === 0) return null;
            return (
              <Box key={exercise.id} sx={{ px: 2, py: 2, borderBottom: `1px solid ${colors.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, color: colors.text }}>{exercise.exercise_name}</Typography>
                  {exercise.replaces && (
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>{t('focus.replaces', { name: exercise.replaces })}</Typography>
                  )}
                </Box>
                <Box role="list" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {sets.map((set) => {
                    const setText = formatSetText(set.weight, set.reps, weightUnit);
                    const technique = set.intensity_technique ? techniqueLabel(set.intensity_technique) : '';
                    const text = technique ? `${setText} · ${technique}` : setText;
                    const chipSx = {
                      bgcolor: colors.bgElevated, borderRadius: '6px', px: 1.125, py: 0.625,
                      fontSize: 12, fontWeight: 600, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums',
                    };
                    const content = <>{set.is_warmup && <WarmupBadge sx={{ mr: 0.75 }} />}{text}</>;
                    // Prima del salvataggio ogni serie si può correggere; dopo no
                    return savedResult ? (
                      <Box key={set.setNumber} role="listitem" sx={chipSx}>{content}</Box>
                    ) : (
                      <Box key={set.setNumber} role="listitem" sx={{ display: 'flex' }}>
                        <ButtonBase sx={{ ...chipSx, minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                          aria-label={t('focus.edit_set.open_aria', {
                            exercise: exercise.exercise_name, name: slotLabel(t, setSlot(exercise, set.setNumber - 1), 'name'),
                            text: technique ? `${setText}, ${technique}` : setText
                          })}
                          onClick={(e) => { e.currentTarget.focus(); setCorrection({ open: true, exercise, setNumber: set.setNumber }); }}>
                          {content}
                        </ButtonBase>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Paper>

        {savedResult ? (
          // Con la chiave React non riusa il pulsante «Salva allenamento» per «Condividi»: il focus perso va sul titolo
          <Fragment key="saved">
            {rewardRows.length > 0 && (
              <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', mb: 3, border: `1px solid ${colors.border}` }}>
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" component="h2" sx={{ color: colors.textSecondary }}>{t('focus.rewards_title')}</Typography>
                </Box>
                <Box component="ul" role="list" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {rewardRows.map((row) => (
                    <Box component="li" key={row.key} sx={{ px: 2, py: 1.5, borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                      {row.celebration && <FireIcon aria-hidden="true" sx={{ color: colors.warningText }} />}
                      <Typography variant={row.celebration ? 'subtitle1' : 'body2'}
                        sx={{ fontWeight: row.celebration ? 700 : 400, color: row.muted ? colors.textSecondary : colors.text, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {row.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            <Button
              variant="outlined" fullWidth size="large" startIcon={<ShareIcon />} onClick={handleShare}
              sx={{ minHeight: 48, borderColor: colors.border, color: colors.text, borderRadius: radius.lg, mb: 2 }}
            >
              {t('focus.share')}
            </Button>

            <Button
              variant="contained" fullWidth size="large"
              onClick={onGoHome}
              sx={{ py: 2, minHeight: 48, fontSize: '1.1rem', fontWeight: 700, bgcolor: colors.primary, color: colors.primaryContrast, borderRadius: radius.lg,
                '&:hover': { bgcolor: colors.primaryDark }, mb: 2 }}
            >
              {t('focus.finish')}
            </Button>

            <ShareCardDialog open={!!shareStats} stats={shareStats} weightUnit={weightUnit} onClose={onCloseShare} />
          </Fragment>
        ) : (
          <Fragment key="editing">
            <TextField label={t('focus.notes_label')} multiline rows={3} value={workoutNotes}
              onChange={(e) => onNotesChange(e.target.value)} fullWidth placeholder={t('focus.notes_placeholder')}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: colors.text, '& fieldset': { borderColor: colors.fieldBorder } }, '& .MuiInputLabel-root': { color: colors.textSecondary } }} />

            <Button variant="contained" fullWidth size="large"
              startIcon={saving ? <ButtonSpinner sx={{ color: colors.primaryContrast }} /> : <SaveIcon />}
              onClick={onSave} disabled={saving || totalCompletedSets === 0}
              sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, bgcolor: colors.primary, color: colors.primaryContrast, borderRadius: radius.lg,
                '&:hover': { bgcolor: colors.primaryDark },
                '&:disabled': { bgcolor: colors.bgElevated, color: colors.textSecondary }, mb: 2 }}>
              {saving ? t('focus.saving') : t('focus.save')}
            </Button>

            <Button variant="text" fullWidth onClick={onQuit} disabled={saving} sx={{ color: colors.textSecondary, py: 1.5 }}>{t('common.cancel')}</Button>
          </Fragment>
        )}
      </Container>

      {correction.exercise && (
        <SetsDoneDialog open={correction.open} onClose={() => setCorrection((c) => ({ ...c, open: false }))} exercise={correction.exercise}
          sets={completedSets[correction.exercise.id] || []} weightUnit={weightUnit} techniqueOn={techniqueOn} onEditSet={onEditSet}
          startEditing={correction.setNumber} />
      )}

      <QuitDialog open={quitDialogOpen} onClose={onCloseQuitDialog} onConfirm={onConfirmQuit}
        title={t('focus.discard_title')} text={t('focus.discard_text', { count: totalCompletedSets })}
        stayLabel={t('focus.discard_stay')} exitLabel={t('focus.discard_exit')} destructive />
    </Box>
  );
}

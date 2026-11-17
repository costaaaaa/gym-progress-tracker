import { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  GlobalStyles,
  Link
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';
import FocusExercisePicker from '../components/FocusExercisePicker';
import { usePageMeta } from '../hooks/usePageMeta';
import { focusedElement } from '../utils/focus';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './focus/useFocusColors';
import useFocusSession from './focus/useFocusSession';
import ResumePromptPhase from './focus/ResumePromptPhase';
import SelectDayPhase from './focus/SelectDayPhase';
import RestTimerPhase from './focus/RestTimerPhase';
import WorkoutPhase from './focus/WorkoutPhase';
import SummaryPhase from './focus/SummaryPhase';
import { radius } from '../theme/radius';
import { plansPath } from '../i18n/paths';

// Focus Mode: switch tra le fasi; stato e transizioni stanno in useFocusSession, la UI di ogni fase in src/pages/focus
const FocusWorkout = () => {
  const { t, i18n } = useTranslation();
  usePageMeta(t('focus.meta.title'), t('focus.meta.description'));

  const { colors, isDarkMode } = useFocusColors();
  const { loading, phase, resumePrompt, selectDay, restTimer, workout, summary, picker, lockedDialog, snackbar } = useFocusSession();

  // Al cambio di fase (e dopo il salvataggio) il pulsante premuto sparisce e il focus finirebbe sul <body>: va sul
  // titolo, ma solo se si è perso. Se un campo l'ha preso da solo (autoFocus del peso) resta lì.
  // Non alla prima schermata (nessun campo da sostituire) e non mentre carica.
  const mainRef = useRef(null);
  const lastScreen = useRef(null);
  const saved = Boolean(summary.savedResult);
  useEffect(() => {
    if (loading) return;
    const last = lastScreen.current;
    if (last && (last.phase !== phase || last.saved !== saved)) {
      const main = mainRef.current;
      if (!main?.contains(focusedElement())) main?.querySelector('h1')?.focus();
    }
    lastScreen.current = { phase, saved };
  }, [loading, phase, saved]);
  // Fine del recupero: l'unico annuncio, niente conto alla rovescia a voce
  const restOver = phase === 'rest_timer' && restTimer.timerDuration > 0 && restTimer.timerRemaining === 0;

  // ================================================
  // RENDER — CONTENUTO IN BASE ALLA FASE
  // ================================================
  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{
          minHeight: '100vh', bgcolor: colors.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <CircularProgress sx={{ color: colors.primary }} />
        </Box>
      );
    }

    if (phase === 'resume_prompt' && resumePrompt.draftToResume) {
      return <ResumePromptPhase {...resumePrompt} />;
    }

    if (phase === 'select_day') {
      return <SelectDayPhase {...selectDay} />;
    }

    if (phase === 'rest_timer') {
      return <RestTimerPhase {...restTimer} />;
    }

    if (phase === 'workout' && workout.currentExercise) {
      return <WorkoutPhase {...workout} />;
    }

    if (phase === 'summary') {
      return <SummaryPhase {...summary} />;
    }

    // Fallback
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  };
  return (
    <>
    <GlobalStyles styles={{
      '.MuiPaper-root.MuiMenu-paper': {
        backgroundColor: `${colors.bgCard} !important`,
        color: `${colors.text} !important`,
        border: `1px solid ${colors.border} !important`,
        boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
      },
      '.MuiMenuItem-root': {
        color: `${colors.text} !important`,
      },
      '.MuiMenuItem-root:hover': {
        backgroundColor: `${colors.bgElevated} !important`,
      },
      '.MuiTypography-root': {
        color: 'inherit',
      }
    }} />
    <Box component="main" ref={mainRef} sx={{ '& h1:focus': { outline: 'none' } }}>
      {renderContent()}
    </Box>
    <Box role="status" aria-live="polite" sx={visuallyHidden}>{restOver ? t('focus.rest_over') : ''}</Box>
      <FocusExercisePicker {...picker} />
      <Dialog open={lockedDialog.open} onClose={lockedDialog.onClose}
        PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: radius.xxl } }}>
        <DialogTitle sx={{ color: colors.text, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ color: colors.warningText }} /> {t('focus.plus_title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.textSecondary }}>
            {t('focus.plus_body')}
          </DialogContentText>
          <Link href={plansPath(i18n.language)} sx={{ color: colors.text, fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
            {t('plans.compare')}
          </Link>
        </DialogContent>
        <DialogActions>
          <Button onClick={lockedDialog.onClose} sx={{ color: colors.text }}>{t('focus.plus_ok')}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={snackbar.onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={snackbar.onClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default FocusWorkout;

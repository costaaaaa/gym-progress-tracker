import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { SkipNext as SkipNextIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { TABULAR } from '../../utils/tabularFont';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function RestTimerPhase({
  timerDuration, timerRemaining, currentExerciseName, nextSetNumber, totalSetsForCurrentExercise, onSkip
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  const progress = timerDuration > 0 ? ((timerDuration - timerRemaining) / timerDuration) * 100 : 0;
  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: colors.bg, color: colors.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3
    }}>
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
        <CircularProgress variant="determinate" value={progress} size={220} thickness={4}
          sx={{ color: colors.text, position: 'relative', zIndex: 1, '& .MuiCircularProgress-circle': { strokeLinecap: 'round', transition: 'stroke-dashoffset 1s linear' } }} />
        <CircularProgress variant="determinate" value={100} size={220} thickness={4}
          sx={{ color: colors.border, position: 'absolute', left: 0, zIndex: 0 }} />
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Typography variant="h2" sx={{ ...TABULAR, fontWeight: 700, color: colors.text }}>{formatTime(timerRemaining)}</Typography>
          <Typography variant="caption" sx={{ color: colors.textMuted, mt: 0.5 }}>{t('focus.rest_caps')}</Typography>
        </Box>
      </Box>
      <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 1 }}>{currentExerciseName}</Typography>
      <Typography variant="body2" sx={{ color: colors.textMuted, mb: 4 }}>{t('focus.next_set', { n: nextSetNumber, total: totalSetsForCurrentExercise })}</Typography>
      <Button variant="outlined" size="large" startIcon={<SkipNextIcon />} onClick={onSkip}
        sx={{ color: colors.text, borderColor: colors.border, borderRadius: '12px', px: 4, py: 1.5, fontSize: '1rem',
          '&:hover': { borderColor: colors.text, bgcolor: colors.bgElevated } }}>
        {t('focus.skip_timer')}
      </Button>
    </Box>
  );
}

import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { SkipNext as SkipNextIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { TABULAR } from '../../utils/fonts';
import { slotLabel } from './slotLabel';
import { radius } from '../../theme/radius';
import { formatWeightInUnit } from '../../utils/weightUnit';
import { clockText } from '../../utils/focusSession';
import { intlLocale } from '../../i18n/format';

export default function RestTimerPhase({
  timerDuration, timerRemaining, currentExerciseName, nextSet, nextWeightKg, nextTarget, weightUnit, onAdjust, onSkip
}) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  const progress = timerDuration > 0 ? ((timerDuration - timerRemaining) / timerDuration) * 100 : 0;
  const nextWeight = nextWeightKg === null ? '' : formatWeightInUnit(nextWeightKg, weightUnit, intlLocale());
  let nextLine = '';
  if (nextWeight && nextTarget) nextLine = t('focus.next_weight_target', { weight: nextWeight, target: nextTarget });
  else if (nextWeight) nextLine = nextWeight;
  else if (nextTarget) nextLine = t('focus.next_target', { target: nextTarget });
  // Stile comune ai tre pulsanti sotto l'anello
  const buttonSx = {
    color: colors.text, borderColor: colors.border, borderRadius: radius.lg, fontSize: '1rem',
    '&:hover': { borderColor: colors.text, bgcolor: colors.bgElevated }
  };
  const adjustSx = { ...buttonSx, minHeight: 44, flex: 1, '&[aria-disabled="true"]': { opacity: 0.5 } };
  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: colors.bg, color: colors.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3
    }}>
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
        <CircularProgress variant="determinate" value={progress} size={220} thickness={4} aria-label={t('focus.rest_progress_aria')}
          sx={{ color: colors.text, position: 'relative', zIndex: 1, '& .MuiCircularProgress-circle': { strokeLinecap: 'round', transition: 'stroke-dashoffset 1s linear' } }} />
        <CircularProgress variant="determinate" value={100} size={220} thickness={4} aria-hidden
          sx={{ color: colors.border, position: 'absolute', left: 0, zIndex: 0 }} />
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Typography variant="h2" component="div" sx={{ ...TABULAR, fontWeight: 700, color: colors.text }}>{clockText(timerRemaining)}</Typography>
          <Typography variant="caption" component="h1" tabIndex={-1} sx={{ color: colors.textSecondary, mt: 0.5 }}>{t('focus.rest')}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, width: '100%', maxWidth: 280, mb: 3 }}>
        <Button variant="outlined" size="large" aria-label={t('focus.rest_minus15_aria')} aria-disabled={timerRemaining === 0 ? 'true' : undefined}
          onClick={() => onAdjust(-15)} sx={adjustSx}>{t('focus.rest_minus15')}</Button>
        <Button variant="outlined" size="large" aria-label={t('focus.rest_plus15_aria')} onClick={() => onAdjust(15)} sx={adjustSx}>{t('focus.rest_plus15')}</Button>
      </Box>
      <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 1 }}>{currentExerciseName}</Typography>
      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: nextLine ? 0.5 : 4 }}>{nextSet && slotLabel(t, nextSet, 'next')}</Typography>
      {nextLine && <Typography variant="body1" data-testid="rest-next-set" sx={{ color: colors.text, fontWeight: 600, mb: 4, textAlign: 'center' }}>{nextLine}</Typography>}
      <Button variant="outlined" size="large" startIcon={<SkipNextIcon />} onClick={onSkip}
        sx={{ ...buttonSx, px: 4, py: 1.5 }}>
        {t('focus.skip_timer')}
      </Button>
    </Box>
  );
}

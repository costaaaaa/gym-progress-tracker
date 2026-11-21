import { Box, ButtonBase, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { slotLabel } from './slotLabel';
import { setSlot } from '../../utils/focusSession';
import { formatSetText } from '../../i18n/format';
import { techniqueLabel } from '../../i18n/labels';
import { radius } from '../../theme/radius';

// Le serie fatte dell'esercizio in corso (le saltate non ci sono), nell'ordine in cui sono state fatte
function SetsDoneContent({ exercise, sets, weightUnit, onClose }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <>
      <DialogTitle id="sets-done-title" sx={{ color: colors.text }}>{t('focus.done_sets.title')}</DialogTitle>
      <DialogContent>
        {sets.length === 0 ? (
          <Typography sx={{ color: colors.textSecondary }}>{t('focus.done_sets.empty')}</Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>{t('focus.done_sets.help')}</Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {sets.map((set) => (
                <Box component="li" key={set.setNumber} sx={{ borderTop: `1px solid ${colors.border}` }}>
                  <ButtonBase sx={{
                    width: '100%', minHeight: 44, py: 1, px: 0.5, borderRadius: radius.sm, justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', gap: 2,
                  }}>
                    {/* setNumber è la posizione (da 1) della serie: si mostra il numero dentro il suo tipo */}
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>{slotLabel(t, setSlot(exercise, set.setNumber - 1), 'name')}</Typography>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ color: colors.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatSetText(set.weight, set.reps, weightUnit)}</Typography>
                      {set.intensity_technique && (
                        <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>{techniqueLabel(set.intensity_technique)}</Typography>
                      )}
                    </Box>
                  </ButtonBase>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: colors.text, minHeight: 44 }}>{t('common.close')}</Button>
      </DialogActions>
    </>
  );
}

export default function SetsDoneDialog({ open, onClose, ...content }) {
  const { colors } = useFocusColors();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="sets-done-title"
      PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: radius.xxl } }}>
      <SetsDoneContent {...content} onClose={onClose} />
    </Dialog>
  );
}

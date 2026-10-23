import { useState } from 'react';
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Link, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Consenso all'ingresso in un gruppo: cosa vedranno gli altri membri e cosa no.
// Senza la spunta il server rifiuta l'ingresso (join.php, code consent_required).
const ShareConsentDialog = ({ open, groupName, username, loading, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);

  const close = () => {
    setAccepted(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700 }}>{t('groups.consent.title', { name: groupName })}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('groups.consent.sees')}</Typography>
        <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5, fontSize: 14 }}>
          <li>{username ? t('groups.consent.sees_username_named', { username }) : t('groups.consent.sees_username')}</li>
          <li>{t('groups.consent.sees_level')}</li>
          <li>{t('groups.consent.sees_week')}</li>
        </Box>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('groups.consent.not_sees')}</Typography>
        <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5, fontSize: 14 }}>
          <li>{t('groups.consent.not_personal')}</li>
          <li>{t('groups.consent.not_details')}</li>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
          {t('groups.consent.leave_anytime')}{' '}
          <Link href="/privacy.html" target="_blank" rel="noopener">{t('groups.consent.privacy')}</Link>
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
          label={t('groups.consent.accept')}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={loading}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={onConfirm} disabled={!accepted || loading}>
          {t('groups.join.cta')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareConsentDialog;

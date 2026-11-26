import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Link, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { legalPaths } from '../../i18n/paths';
import GroupVisibilityOptions from './GroupVisibilityOptions';

// Consenso all'ingresso in un gruppo: cosa vedranno gli altri membri e cosa no. Lo username si vede sempre; il resto sono
// le opzioni dell'account, che qui si cambiano e si salvano subito (valgono per tutti i gruppi).
// Senza la spunta il server rifiuta l'ingresso (join.php, code consent_required).
const ShareConsentDialog = ({ open, groupName, username, loading, onClose, onConfirm }) => {
  const { t, i18n } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  // Esito dell'ultimo cambio di un'opzione: { message, severity }
  const [note, setNote] = useState(null);

  const close = () => {
    setAccepted(false);
    setNote(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700 }}>{t('groups.consent.title', { name: groupName })}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('groups.consent.sees')}</Typography>
        <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5, fontSize: 14 }}>
          <li>{username ? t('groups.consent.sees_username_named', { username }) : t('groups.consent.sees_username')}</li>
        </Box>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('groups.consent.optional')}</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 0.5 }}>{t('groups.shown.applies_to_all')}</Typography>
        <GroupVisibilityOptions notify={(message, severity) => setNote({ message, severity })} idPrefix="consent-shown" />
        <Box role="status" sx={{ mt: 1 }}>
          {note?.severity === 'success' && <Typography sx={{ fontSize: 14, mb: 1 }}>{note.message}</Typography>}
        </Box>
        {note?.severity === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{note.message}</Alert>}
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t('groups.consent.not_sees')}</Typography>
        <Box component="ul" sx={{ mt: 0, mb: 2, pl: 2.5, fontSize: 14 }}>
          <li>{t('groups.consent.not_personal')}</li>
          <li>{t('groups.consent.not_details')}</li>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
          {t('groups.consent.leave_anytime')}{' '}
          <Link href={legalPaths(i18n.language).privacy} target="_blank" rel="noopener">{t('groups.consent.privacy')}</Link>
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
          label={t('groups.consent.accept')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={loading}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={onConfirm} disabled={!accepted || loading}>
          {t('groups.join.cta')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareConsentDialog;

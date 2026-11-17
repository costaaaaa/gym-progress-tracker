import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import EmailCodeForm from './EmailCodeForm';

// Finestra del codice a 6 cifre: dopo la registrazione, dal promemoria del giorno, dalla striscia e da Account.
// «Più tardi» la chiude; a conferma avvenuta si chiude da sola (onConfirmed).
const TITLE_ID = 'email-confirm-title';

const EmailConfirmDialog = ({ open, onClose, onConfirmed }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby={TITLE_ID}>
      <DialogTitle id={TITLE_ID} component="h2">{t('emailconfirm.title')}</DialogTitle>
      <DialogContent>
        <EmailCodeForm
          autoFocus
          onConfirmed={onConfirmed}
          actions={<Button type="button" onClick={onClose} sx={{ minHeight: 44, fontSize: 16 }}>{t('emailconfirm.later')}</Button>}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EmailConfirmDialog;

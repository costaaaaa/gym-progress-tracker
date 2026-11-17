import { useState } from 'react';
import { Alert, Box, Button, Card, Snackbar, Typography } from '@mui/material';
import { Download as DownloadIcon, DeleteForever as DeleteForeverIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useDataExport from '../../hooks/useDataExport';
import { NEUTRAL_OUTLINED } from '../../utils/buttonStyles';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import DeleteAccountDialog from '../Account/DeleteAccountDialog';
import ButtonSpinner from '../ButtonSpinner';
import EmailCodeForm from './EmailCodeForm';
import ChangeEmailDialog from './ChangeEmailDialog';

// Dal giorno 8 senza email confermata il layout mostra questa schermata al posto di ogni pagina dell'app:
// codice e reinvio (non in finestra), correzione dell'indirizzo, esporta i dati, elimina l'account, esci.
// Sono le sole cose che il server accetta ancora. A conferma avvenuta lo stato si rilegge e il layout
// rimette le pagine: l'app riparte senza ricaricare.
const EmailBlockedScreen = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [changeOpen, setChangeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const notify = (message, severity) => setSnackbar({ open: true, message, severity });
  const { exporting, download } = useDataExport(user?.username, notify);

  const handleDeleted = () => {
    notify(t('account.delete.done'), 'success');
    setTimeout(() => {
      logout();
      navigate('/');
    }, 2000);
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      <Card sx={{ p: '24px' }}>
        <Typography component="h1" sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 22, mb: 1 }}>
          {t('emailblocked.title')}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 3 }}>{t('emailblocked.text')}</Typography>
        <EmailCodeForm
          actions={<Button type="button" onClick={() => setChangeOpen(true)} sx={{ minHeight: 44 }}>{t('emailchange.open')}</Button>}
        />
      </Card>

      <Card sx={{ p: '24px' }}>
        <Typography component="h2" variant="cardTitle">{t('emailblocked.data_title')}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={exporting ? <ButtonSpinner size={16} /> : <DownloadIcon />}
            onClick={download}
            disabled={exporting}
            sx={{ ...NEUTRAL_OUTLINED, minHeight: 44 }}
          >
            {t('emailblocked.export')}
          </Button>
        </Box>
        <Typography sx={{ color: 'text.secondary', mt: 2, mb: 1.5 }}>{t('emailblocked.delete_help')}</Typography>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={() => setDeleteOpen(true)}
          sx={{ fontSize: 16, minHeight: 44 }}
        >
          {t('account.delete.title')}
        </Button>
      </Card>

      <Box>
        <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44 }}>
          {t('account.session.logout')}
        </Button>
      </Box>

      <ChangeEmailDialog open={changeOpen} onClose={() => setChangeOpen(false)} />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={handleDeleted} />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmailBlockedScreen;

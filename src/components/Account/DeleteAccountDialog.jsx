import { useState, useEffect } from 'react';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControlLabel, TextField, Typography,
} from '@mui/material';
import { Cancel as CancelIcon, DeleteForever as DeleteForeverIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import PasswordToggle from '../Auth/PasswordToggle';

// Finestra «Elimina account»: password e conferma, poi delete.php. Usata da Account e dalla schermata di
// conferma dell'email (stesso flusso, stesse conferme). A eliminazione riuscita chiama onDeleted: chi la usa
// mostra l'esito ed esce.
const DeleteAccountDialog = ({ open, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Ogni apertura riparte da capo
  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmed(false);
      setError('');
    }
  }, [open]);

  const handleDelete = async () => {
    // Validazione
    if (!password) {
      setError(t('account.delete.password_required'));
      return;
    }
    if (!confirmed) {
      setError(t('account.delete.confirm_required'));
      return;
    }

    setDeleting(true);
    setError('');

    try {
      // Password inviata in chiaro su HTTPS; la verifica avviene lato server
      const response = await fetch(`${API_BASE_URL}api/user/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password
        }),
        credentials: 'include'
      });

      // Analisi della risposta
      const data = await response.json();

      if (!response.ok) {
        const failure = new Error(data.message || t('account.delete.error'));
        failure.status = response.status;
        throw failure;
      }

      onClose();
      onDeleted();
    } catch (err) {
      console.error('Errore durante l\'eliminazione dell\'account:', err);

      // Gestione dei diversi tipi di errore
      if (err.status === 401) {
        setError(t('account.session_expired'));
      } else {
        setError(err.message || t('account.delete.error_retry'));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center' }}>
        <DeleteForeverIcon sx={{ mr: 1 }} /> {t('account.delete.title')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2, color: 'text.primary' }}>
          {t('account.delete.intro')}
        </DialogContentText>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: 16 }}>
            {t('account.delete.warning_title')}
          </Typography>
          <Typography>
            {t('account.delete.warning_text')}
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          margin="dense"
          label={t('account.password.title')}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          fullWidth
          variant="outlined"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={deleting}
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} label={t('password.show')} disabled={deleting} />
            ),
          }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={deleting}
              color="error"
            />
          }
          label={t('account.delete.confirm_label')}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          startIcon={<CancelIcon />}
          disabled={deleting}
          sx={{ fontSize: 16 }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={deleting || !confirmed}
          sx={{ fontSize: 16 }}
        >
          {deleting ? t('account.delete.in_progress') : t('account.delete.title')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteAccountDialog;

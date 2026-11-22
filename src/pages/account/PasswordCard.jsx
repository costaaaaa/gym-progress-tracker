import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  Lock as LockIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '../../i18n/format';
import { API_BASE_URL } from '../../config';
import { validatePassword } from '../../utils/passwordPolicy';
import { NEUTRAL_OUTLINED } from '../../utils/buttonStyles';
import useFocusField from '../../hooks/useFocusField';
import useConfirmPassword from '../../hooks/useConfirmPassword';
import ConfirmPasswordField from '../../components/Auth/ConfirmPasswordField';
import PasswordToggle from '../../components/Auth/PasswordToggle';

// Card della password: quando è stata cambiata l'ultima volta (da `account.password_changed_at`) e la finestra per
// cambiarla, con i suoi campi, la validazione e la richiesta.
const PasswordCard = ({ account, notify }) => {
  const { t } = useTranslation();
  const [changedAt, setChangedAt] = useState(account?.password_changed_at);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const confirmPair = useConfirmPassword({ password: newPassword, confirm: confirmPassword });
  const { fieldRef, focusField } = useFocusField();

  // Funzioni per la gestione del dialog di cambio password
  const handleOpenPasswordDialog = () => {
    setOpenPasswordDialog(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    confirmPair.reset();
  };

  const handleClosePasswordDialog = () => {
    setOpenPasswordDialog(false);
  };

  const handleChangePassword = async () => {
    confirmPair.submit();
    // Validazione
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('account.password.all_required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      // L'errore sta nella riga sotto «Conferma»: niente avviso in alto, il focus va al campo
      setPasswordError('');
      focusField('confirmPassword');
      return;
    }

    // Validazione sicurezza nuova password
    const passwordValidationError = validatePassword(newPassword);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    // Verifica che la nuova password sia diversa da quella attuale
    if (currentPassword === newPassword) {
      setPasswordError(t('account.password.same'));
      return;
    }

    setChangingPassword(true);
    setPasswordError('');

    try {
      // Password inviate in chiaro su HTTPS; l'hashing bcrypt avviene lato server
      const response = await fetch(`${API_BASE_URL}api/user/change_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
        credentials: 'include'
      });

      // Analisi della risposta
      const data = await response.json();

      if (!response.ok) {
        const failure = new Error(data.message || t('account.password.error'));
        failure.status = response.status;
        throw failure;
      }

      // Chiudiamo il dialog e mostriamo il messaggio di successo
      handleClosePasswordDialog();
      notify(t('account.password.changed'), 'success');

      // Aggiorna la data di ultima modifica mostrata nella card
      setChangedAt(new Date().toISOString());
    } catch (error) {
      console.error('Errore durante il cambio password:', error);

      // Gestione dei diversi tipi di errore
      if (error.status === 401) {
        setPasswordError(t('account.session_expired'));
      } else {
        setPasswordError(error.message || t('account.password.error_retry'));
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordChangedLabel = changedAt
    ? t('account.password.last_changed', { when: formatDistanceToNow(parseISO(changedAt), { locale: dateFnsLocale(), addSuffix: true }) })
    : t('account.password.never_changed');

  return (
    <>
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle">{t('account.password.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>{passwordChangedLabel}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<LockIcon />} onClick={handleOpenPasswordDialog} sx={NEUTRAL_OUTLINED}>
            {t('account.password.change')}
          </Button>
        </Box>
      </Card>

      <Dialog open={openPasswordDialog} onClose={handleClosePasswordDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('account.password.change')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('account.password.intro')}
          </DialogContentText>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}

          <TextField
            margin="dense"
            label={t('account.password.current')}
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            fullWidth
            variant="outlined"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={changingPassword}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <PasswordToggle shown={showCurrentPassword} onToggle={() => setShowCurrentPassword(!showCurrentPassword)} label={t('account.password.show_current')} disabled={changingPassword} />
              ),
            }}
          />

          <Box onBlur={confirmPair.leave}>
            <TextField
              margin="dense"
              label={t('account.password.new')}
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              fullWidth
              variant="outlined"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); confirmPair.edit(); }}
              required
              disabled={changingPassword}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <PasswordToggle shown={showNewPassword} onToggle={() => setShowNewPassword(!showNewPassword)} label={t('account.password.show_new')} disabled={changingPassword} />
                ),
              }}
            />
          </Box>

          <ConfirmPasswordField
            pair={confirmPair}
            margin="dense"
            label={t('account.password.confirm')}
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); confirmPair.edit(); }}
            inputRef={fieldRef('confirmPassword')}
            required
            disabled={changingPassword}
            InputProps={{
              endAdornment: (
                <PasswordToggle shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} label={t('password.show_confirm')} disabled={changingPassword} />
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClosePasswordDialog}
            startIcon={<CancelIcon />}
            disabled={changingPassword}
            sx={{ fontSize: 16 }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleChangePassword}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={changingPassword}
            sx={{ fontSize: 16 }}
          >
            {changingPassword ? t('focus.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PasswordCard;

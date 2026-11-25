import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { Cancel as CancelIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { changeEmail } from '../../api/emailVerification';
import useFocusField from '../../hooks/useFocusField';
import PasswordToggle from '../Auth/PasswordToggle';
import ButtonSpinner from '../ButtonSpinner';
import { formatWait } from './EmailCodeForm';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLE_ID = 'email-change-title';

// «Cambia indirizzo»: nuovo indirizzo e password. Account non confermato: l'indirizzo cambia subito; account
// confermato: il nuovo resta «in attesa» finché non si scrive il codice. onChanged({ mode, email, pendingEmail })
// parte a cambio accettato (stato già riletto); chi la usa apre la finestra del codice.
const ChangeEmailDialog = ({ open, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { emailState, refreshEmailState } = useAuth();
  const { fieldRef, focusField } = useFocusField();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Ogni apertura riparte da capo
  useEffect(() => {
    if (open) {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setErrors({});
      setFormError('');
    }
  }, [open]);

  const fail = (field, message) => {
    setErrors({ [field]: message });
    focusField(field);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (!EMAIL_RE.test(address)) return fail('email', t('emailchange.error_invalid'));
    if (!password) return fail('password', t('emailchange.error_password_missing'));

    setBusy(true);
    setErrors({});
    setFormError('');
    const res = await changeEmail(address, password);
    setBusy(false);

    if (res.ok) {
      await refreshEmailState();
      onClose();
      onChanged?.({ mode: res.data.mode, email: res.data.email ?? null, pendingEmail: res.data.pending_email ?? null });
      return;
    }
    switch (res.data?.code) {
      case 'email_taken': return fail('email', t('emailchange.error_taken'));
      case 'email_same': return fail('email', t('emailchange.error_same'));
      case 'email_invalid': return fail('email', t('emailchange.error_invalid'));
      case 'email_resend_wait': return fail('email', t('emailchange.error_wait', { time: formatWait(res.data.retry_after ?? 0) }));
      case 'wrong_password': return fail('password', t('emailchange.error_password'));
      default: setFormError(res.status === 0 ? t('emailconfirm.error_network') : (res.data?.message || t('emailconfirm.error_generic')));
    }
  };

  const verified = emailState?.verified === true;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby={TITLE_ID}>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle id={TITLE_ID} component="h2">{t('emailchange.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            {verified ? t('emailchange.intro_verified') : t('emailchange.intro_unverified')}
          </DialogContentText>
          {formError && <Alert severity="error" sx={{ my: 1 }}>{formError}</Alert>}
          <TextField
            margin="dense"
            fullWidth
            required
            autoFocus
            type="email"
            label={t('emailchange.new_email')}
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
            inputRef={fieldRef('email')}
            error={Boolean(errors.email)}
            helperText={errors.email}
            disabled={busy}
          />
          <TextField
            margin="dense"
            fullWidth
            required
            type={showPassword ? 'text' : 'password'}
            label={t('emailchange.password')}
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: undefined })); }}
            inputRef={fieldRef('password')}
            error={Boolean(errors.password)}
            helperText={errors.password}
            disabled={busy}
            InputProps={{
              endAdornment: (
                <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} label={t('password.show')} disabled={busy} />
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} startIcon={<CancelIcon />} disabled={busy} sx={{ minHeight: 44 }}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={busy} sx={{ minHeight: 44 }}
            startIcon={busy ? <ButtonSpinner size={16} /> : undefined}>
            {t('emailchange.submit')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ChangeEmailDialog;

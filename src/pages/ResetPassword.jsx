import { useEffect, useRef, useState } from 'react';
import { TextField, Button, Box, Alert, Link, InputAdornment, IconButton } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '../i18n/paths';
import { validatePassword } from '../utils/passwordPolicy';
import AuthLayout from '../components/Auth/AuthLayout';
import ConfirmPasswordField from '../components/Auth/ConfirmPasswordField';
import useConfirmPassword from '../hooks/useConfirmPassword';

const ResetPassword = () => {
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(t('reset.meta.title'), t('reset.meta.description'));
  const [searchParams] = useSearchParams();
  // Il link nuovo porta il token nel fragment (#token=...), che non arriva al server né ai suoi log;
  // quello dei link già inviati sta ancora nella query (?token=...) e vale finché non scade
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || searchParams.get('token') || '',
  );

  // Il token resta in memoria e sparisce dalla barra e dalla cronologia (non deve finire in un segnalibro)
  useEffect(() => {
    if (searchParams.has('token') || window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef(null);
  const pair = useConfirmPassword({ password, confirm, mismatchText: t('reset.error.mismatch') });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    pair.submit();
    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirm) {
      // Conferma scritta: l'errore sta nella riga sotto il campo; conferma vuota: nell'avviso in alto
      if (confirm) confirmRef.current?.focus();
      else setError(t('reset.error.mismatch'));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/reset_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t('reset.error.generic'));
      }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('reset.title')}>
      {done ? (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>{t('reset.done')}</Alert>
          <Button component={RouterLink} to={localizedPath('/login')} fullWidth variant="contained">{t('reset.go_to_login')}</Button>
        </>
      ) : !token ? (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>{t('reset.invalid_link')}</Alert>
          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to={localizedPath('/forgot-password')}>{t('reset.request_new')}</Link>
          </Box>
        </>
      ) : (
        <>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box onBlur={pair.leave}>
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label={t('reset.new_password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => { setPassword(e.target.value); pair.edit(); }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={t('password.show')}
                        onClick={() => setShowPassword(!showPassword)}
                        // Il clic sull'occhio non toglie il focus al campo: non è un'uscita
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <ConfirmPasswordField
              pair={pair}
              margin="normal"
              required
              fullWidth
              name="confirm"
              label={t('reset.repeat_password')}
              type={showPassword ? 'text' : 'password'}
              id="confirm"
              inputRef={confirmRef}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); pair.edit(); }}
            />
            <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, mb: 1 }} disabled={loading}>
              {loading ? t('reset.submitting') : t('reset.submit')}
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Link component={RouterLink} to={localizedPath('/forgot-password')}>{t('reset.request_new')}</Link>
          </Box>
        </>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;

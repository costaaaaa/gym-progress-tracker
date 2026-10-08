import { useState } from 'react';
import { Typography, Paper, TextField, Button, Box, Alert, Link, InputAdornment, IconButton } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '../i18n/paths';
import { validatePassword } from '../utils/passwordPolicy';

const ResetPassword = () => {
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(t('reset.meta.title'), t('reset.meta.description'));
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirm) {
      setError(t('reset.error.mismatch'));
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
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          {t('reset.title')}
        </Typography>

        {done ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>{t('reset.done')}</Alert>
            <Button component={RouterLink} to={localizedPath('/login')} fullWidth variant="contained">{t('reset.go_to_login')}</Button>
          </>
        ) : !token ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>{t('reset.invalid_link')}</Alert>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to={localizedPath('/forgot-password')} variant="body2">{t('reset.request_new')}</Link>
            </Box>
          </>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit} noValidate>
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
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={t('password.show')}
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirm"
                label={t('reset.repeat_password')}
                type={showPassword ? 'text' : 'password'}
                id="confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, mb: 1 }} disabled={loading}>
                {loading ? t('reset.submitting') : t('reset.submit')}
              </Button>
            </Box>
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Link component={RouterLink} to={localizedPath('/forgot-password')} variant="body2">{t('reset.request_new')}</Link>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ResetPassword;

import { useState } from 'react';
import { Typography, TextField, Button, Box, Alert, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '../i18n/paths';
import AuthLayout from '../components/Auth/AuthLayout';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(t('forgot.meta.title'), t('forgot.meta.description'));
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/forgot_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t('forgot.error.generic'));
      }
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('forgot.title')}>

        {message ? (
          <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>
              {t('forgot.intro')}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label={t('forgot.email')}
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, mb: 1 }} disabled={loading}>
                {loading ? t('forgot.submitting') : t('forgot.submit')}
              </Button>
            </Box>
          </>
        )}

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link component={RouterLink} to={localizedPath('/login')}>
            {t('forgot.back_to_login')}
          </Link>
        </Box>
    </AuthLayout>
  );
};

export default ForgotPassword;

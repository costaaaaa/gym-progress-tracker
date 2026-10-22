import { useState } from 'react';
import { Typography, TextField, Button, Box, Alert, Link, InputAdornment, IconButton } from '@mui/material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { usePageMeta } from '../hooks/usePageMeta';
import { safeNext } from '../utils/safeNext';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '../i18n/paths';
import AuthLayout from '../components/Auth/AuthLayout';

const Login = () => {
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(t('login.meta.title'), t('login.meta.description'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Dove tornare dopo l'accesso, per esempio un link di invito a un gruppo
  const next = safeNext(location.search);
  const { login } = useAuth();
  
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Password inviata in chiaro su HTTPS; l'hashing bcrypt avviene lato server
      const response = await fetch(`${API_BASE_URL}api/user/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('login.error.generic'));
      }

      // Utilizziamo la funzione login dal context
      login(data.user);
      
      // Torna alla pagina richiesta (di default la home)
      navigate(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('login.title')} side={{ title: t('login.side.title'), text: t('login.side.text') }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          id="username"
          label={t('login.username')}
          name="username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label={t('login.password')}
          type={showPassword ? "text" : "password"}
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={t('login.toggle_password')}
                  onClick={handleTogglePasswordVisibility}
                  edge="end"
                >
                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={loading}
        >
          {loading ? t('login.submitting') : t('login.submit')}
        </Button>
        <Box sx={{ textAlign: 'center' }}>
          <Link component={RouterLink} to={localizedPath('/forgot-password')}>
            {t('login.forgot')}
          </Link>
        </Box>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography>
            {t('login.no_account')}{' '}
            <Link component={RouterLink} to={next === '/' ? localizedPath('/register') : `${localizedPath('/register')}?next=${encodeURIComponent(next)}`}>
              {t('login.register')}
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default Login;
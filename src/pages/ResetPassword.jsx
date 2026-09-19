import { useState } from 'react';
import { Typography, Paper, TextField, Button, Box, Alert, Link, InputAdornment, IconButton } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { usePageMeta } from '../hooks/usePageMeta';

const MIN_PASSWORD_LENGTH = 8;

const ResetPassword = () => {
  usePageMeta('Nuova password', 'Scegli una nuova password per il tuo account.');
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
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
      return;
    }
    if (password !== confirm) {
      setError('Le due password non coincidono.');
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
        throw new Error(data.message || 'Errore durante il reset');
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
          Nuova password
        </Typography>

        {done ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>Password reimpostata. Ora puoi accedere.</Alert>
            <Button component={RouterLink} to="/login" fullWidth variant="contained">Vai all'accesso</Button>
          </>
        ) : !token ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>Link non valido. Richiedine uno nuovo.</Alert>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">Richiedi un nuovo link</Link>
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
                label="Nuova password"
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
                        aria-label="mostra o nascondi la password"
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
                label="Ripeti la password"
                type={showPassword ? 'text' : 'password'}
                id="confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, mb: 1 }} disabled={loading}>
                {loading ? 'Salvataggio...' : 'Salva la password'}
              </Button>
            </Box>
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">Richiedi un nuovo link</Link>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ResetPassword;

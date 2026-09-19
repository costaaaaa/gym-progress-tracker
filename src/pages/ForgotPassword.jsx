import { useState } from 'react';
import { Typography, Paper, TextField, Button, Box, Alert, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { usePageMeta } from '../hooks/usePageMeta';

const ForgotPassword = () => {
  usePageMeta('Password dimenticata', 'Reimposta la password del tuo account.');
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
        throw new Error(data.message || 'Errore durante la richiesta');
      }
      setMessage(data.message);
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
          Password dimenticata
        </Typography>

        {message ? (
          <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Inserisci l'email con cui ti sei registrato: ti invieremo un link per scegliere una nuova password.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, mb: 1 }} disabled={loading}>
                {loading ? 'Invio in corso...' : 'Invia il link'}
              </Button>
            </Box>
          </>
        )}

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link component={RouterLink} to="/login" variant="body2">
            Torna all'accesso
          </Link>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPassword;

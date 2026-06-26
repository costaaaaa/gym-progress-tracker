import React, { useState } from 'react';
import { 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Box, 
  Alert, 
  Link, 
  InputAdornment, 
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid 
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, subYears, startOfToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [gender, setGender] = useState('M');
  const [trainingStartDate, setTrainingStartDate] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validazione sicurezza password
  const validatePassword = (pass) => {
    const minLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    
    if (!minLength) return "La password deve contenere almeno 8 caratteri";
    if (!hasUpper) return "La password deve contenere almeno una lettera maiuscola";
    if (!hasLower) return "La password deve contenere almeno una lettera minuscola";
    if (!hasNumber) return "La password deve contenere almeno un numero";
    if (!hasSpecial) return "La password deve contenere almeno un carattere speciale (!@#$%^&*)";
    
    return null;
  };
  
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validazione sicurezza password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }
    
    setLoading(true);

    try {
      // Password inviata in chiaro su HTTPS; l'hashing bcrypt avviene lato server
      const response = await fetch(`${API_BASE_URL}api/user/register.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
          birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
          gender,
          training_start_date: trainingStartDate ? format(trainingStartDate, 'yyyy-MM-01') : null
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante la registrazione');
      }

      // Mostra messaggio di successo
      setSuccess('Registrazione completata con successo! Effettua il login...');
      
      // Auto-login opzionale
      if (data.user) {
        login(data.user);
        setTimeout(() => navigate('/'), 1500);
      } else {
        setTimeout(() => navigate('/login'), 1500);
      }
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
          Registrati
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
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
            id="email"
            label="Email"
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
            Profilo per il recupero muscolare
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Data di Nascita"
                value={birthDate}
                onChange={(newValue) => setBirthDate(newValue)}
                minDate={subYears(startOfToday(), 100)}
                maxDate={startOfToday()}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    id: "birthDate",
                    name: "birthDate"
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Sesso</InputLabel>
                <Select
                  value={gender}
                  label="Sesso"
                  onChange={(e) => setGender(e.target.value)}
                >
                  <MenuItem value="M">Maschio</MenuItem>
                  <MenuItem value="F">Femmina</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <DatePicker
                label="Mese Inizio Allenamento"
                value={trainingStartDate}
                onChange={(newValue) => setTrainingStartDate(newValue)}
                views={['year', 'month']}
                openTo="month"
                minDate={birthDate || undefined}
                maxDate={startOfToday()}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    id: "trainingStartDate",
                    name: "trainingStartDate",
                    helperText: "Seleziona mese e anno in cui hai iniziato"
                  }
                }}
              />
            </Grid>
          </Grid>
          </LocalizationProvider>

          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
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
            name="confirmPassword"
            label="Conferma Password"
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
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
            {loading ? 'Registrazione in corso...' : 'Registrati'}
          </Button>
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2">
              Hai già un account?{' '}
              <Link component={RouterLink} to="/login" variant="body2">
                Accedi
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Register;
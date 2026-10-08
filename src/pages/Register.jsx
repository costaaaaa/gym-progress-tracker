import { useState } from 'react';
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
  Grid,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, subYears, startOfToday } from 'date-fns';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../utils/passwordPolicy';
import { safeNext } from '../utils/safeNext';
import { track } from '../utils/analytics';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation, Trans } from 'react-i18next';
import DateLocalization from '../i18n/DateLocalization';
import { useLocalizedPath } from '../i18n/paths';

const Register = () => {
  const { t, i18n } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(t('register.meta.title'), t('register.meta.description'));
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [gender, setGender] = useState('');
  const [trainingStartDate, setTrainingStartDate] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  const navigate = useNavigate();
  const location = useLocation();
  // Dove tornare dopo la registrazione, per esempio un link di invito a un gruppo
  const next = safeNext(location.search);
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
      setError(t('register.error.password_mismatch'));
      return;
    }

    if (!birthDate) {
      setError(t('register.error.birth_date_required'));
      return;
    }
    if (birthDate > subYears(startOfToday(), 14)) {
      setError(t('register.error.min_age'));
      return;
    }
    if (!gender) {
      setError(t('register.error.gender_required'));
      return;
    }
    if (!acceptTerms) {
      setError(t('register.error.terms_required'));
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
          accept_terms: true,
          locale: i18n.language,
          training_start_date: trainingStartDate ? format(trainingStartDate, 'yyyy-MM-01') : null
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('register.error.generic'));
      }

      track('signup', { lang: i18n.language });

      // Accesso automatico con le stesse credenziali, come fa l'app: chi arriva da un
      // invito torna subito al gruppo senza ridigitare la password.
      const loginResponse = await fetch(`${API_BASE_URL}api/user/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      const loginData = await loginResponse.json().catch(() => ({}));

      if (loginResponse.ok && loginData.user) {
        login(loginData.user);
        navigate(next);
      } else {
        setSuccess(t('register.success_login'));
        setTimeout(() => navigate(next === '/' ? localizedPath('/login') : `${localizedPath('/login')}?next=${encodeURIComponent(next)}`), 1500);
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
          {t('register.title')}
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
            label={t('register.username')}
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
            label={t('register.email')}
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
            {t('register.profile_section')}
          </Typography>
          <DateLocalization>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label={t('register.birth_date')}
                value={birthDate}
                onChange={(newValue) => setBirthDate(newValue)}
                minDate={subYears(startOfToday(), 100)}
                maxDate={subYears(startOfToday(), 14)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    helperText: t('register.birth_date_help'),
                    id: "birthDate",
                    name: "birthDate"
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('register.gender')}</InputLabel>
                <Select
                  value={gender}
                  label={t('register.gender')}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <MenuItem value="M">{t('register.gender_m')}</MenuItem>
                  <MenuItem value="F">{t('register.gender_f')}</MenuItem>
                  <MenuItem value="O">{t('register.gender_o')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <DatePicker
                label={t('register.training_start')}
                value={trainingStartDate}
                onChange={(newValue) => setTrainingStartDate(newValue)}
                views={['year', 'month']}
                format="MM/yyyy"
                openTo="month"
                minDate={birthDate || undefined}
                maxDate={startOfToday()}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    id: "trainingStartDate",
                    name: "trainingStartDate",
                    helperText: t('register.training_start_help')
                  }
                }}
              />
            </Grid>
          </Grid>
          </DateLocalization>

          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label={t('register.password')}
            type={showPassword ? "text" : "password"}
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t('password.show')}
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
            label={t('register.confirm_password')}
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t('password.show_confirm')}
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <FormControlLabel
            sx={{ mt: 2, alignItems: 'flex-start' }}
            control={
              <Checkbox
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                sx={{ pt: 0.5 }}
              />
            }
            label={
              <Typography variant="body2">
                <Trans
                  i18nKey="register.terms"
                  components={{
                    terms: <Link href="/termini.html" target="_blank" rel="noopener" />,
                    privacy: <Link href="/privacy.html" target="_blank" rel="noopener" />,
                  }}
                />
              </Typography>
            }
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? t('register.submitting') : t('register.submit')}
          </Button>
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2">
              {t('register.have_account')}{' '}
              <Link component={RouterLink} to={next === '/' ? localizedPath('/login') : `${localizedPath('/login')}?next=${encodeURIComponent(next)}`} variant="body2">
                {t('register.login')}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Register;
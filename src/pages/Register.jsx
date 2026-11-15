import { useState } from 'react';
import {
  Typography,
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
  Checkbox,
  FormControlLabel,
  FormHelperText
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import LabeledDatePicker from '../components/LabeledDatePicker';
import { format, subYears, startOfToday } from 'date-fns';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../utils/passwordPolicy';
import { safeNext } from '../utils/safeNext';
import { track } from '../utils/analytics';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation, Trans } from 'react-i18next';
import DateLocalization from '../i18n/DateLocalization';
import { useLocalizedPath, legalPaths } from '../i18n/paths';
import AuthLayout from '../components/Auth/AuthLayout';
import useFocusField from '../hooks/useFocusField';

// Username: stessa regola di register.php. Email: solo un primo filtro, il server usa FILTER_VALIDATE_EMAIL
const USERNAME_RE = /^[a-zA-Z0-9]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ordine dei campi di ogni passo (il primo con un errore riceve il focus)
const STEP1_FIELDS = ['username', 'email', 'password', 'confirmPassword'];
const STEP2_FIELDS = ['birthDate', 'gender', 'terms'];

// Il server rifiuta una data di nascita più vecchia di 100 anni
const oldestBirthDate = () => subYears(startOfToday(), 100);

const Register = () => {
  const { t, i18n } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(t('register.meta.title'), t('register.meta.description'));
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  // Vista con cui si apre il calendario: fissata all'apertura, perché se cambiasse con la data MUI riporterebbe ai giorni.
  const [birthOpenTo, setBirthOpenTo] = useState('year');
  const [gender, setGender] = useState('');
  const [trainingStartDate, setTrainingStartDate] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  // Due passaggi: 1 = account (controllato subito con check_availability.php), 2 = profilo per il recupero.
  // La registrazione parte solo alla fine, con una chiamata sola.
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { fieldRef, focusField } = useFocusField();
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

  const withNext = (path) => (next === '/' ? localizedPath(path) : `${localizedPath(path)}?next=${encodeURIComponent(next)}`);

  // Errore sul campo: per l'email già registrata, con i link per accedere o recuperare la password
  const takenError = (field) => (field === 'email' ? (
    <Trans
      i18nKey="register.error.email_taken"
      components={{
        login: <Link component={RouterLink} to={withNext('/login')} />,
        forgot: <Link component={RouterLink} to={localizedPath('/forgot-password')} />,
      }}
    />
  ) : t('register.error.username_taken'));

  // L'errore di un campo sparisce mentre si scrive; uscendo dal campo può solo comparire. Se sparisse
  // all'uscita, il clic su "Avanti" sposterebbe il bottone sotto il dito e andrebbe perso.
  const clearError = (field) => setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  const edit = (setter, field) => (e) => {
    setter(e.target.value);
    clearError(field);
  };

  const checkConfirm = () => {
    if (confirmPassword && confirmPassword !== password) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: t('register.error.password_mismatch') }));
    }
  };

  const handleNext = async () => {
    setError('');
    const errors = {
      username: USERNAME_RE.test(username) ? '' : t('register.username_help'),
      email: EMAIL_RE.test(email.trim()) ? '' : t('register.error.email_format'),
      password: validatePassword(password) || '',
      confirmPassword: password === confirmPassword ? '' : t('register.error.password_mismatch'),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      focusField(STEP1_FIELDS.find((field) => errors[field]));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/check_availability.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 429) {
        setError(data.message || t('register.error.generic'));
        return;
      }
      if (response.ok && (data.username_taken || data.email_taken)) {
        setFieldErrors({
          username: data.username_taken ? takenError('username') : '',
          email: data.email_taken ? takenError('email') : '',
        });
        focusField(data.username_taken ? 'username' : 'email');
        return;
      }
    } catch {
      // Controllo non raggiungibile: si va avanti, register.php ripete comunque la verifica
    } finally {
      setLoading(false);
    }
    track('register_step2', { lang: i18n.language });
    setStep(2);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setFieldErrors({});

    // Un errore sotto ogni campo sbagliato, il focus sul primo
    const errors = {
      birthDate: !birthDate ? t('register.error.birth_date_required')
        : birthDate > subYears(startOfToday(), 14) ? t('register.error.min_age')
          : birthDate < oldestBirthDate() ? t('register.error.birth_date_invalid') : '',
      gender: gender ? '' : t('register.error.gender_required'),
      terms: acceptTerms ? '' : t('register.error.terms_required'),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      focusField(STEP2_FIELDS.find((field) => errors[field]));
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

      // Username o email presi nel frattempo: si torna al primo passo, con l'errore sul campo
      if (response.status === 409 && (data.field === 'username' || data.field === 'email')) {
        setFieldErrors({ [data.field]: takenError(data.field) });
        setStep(1);
        focusField(data.field);
        return;
      }
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
        setTimeout(() => navigate(withNext('/login')), 1500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (step === 1) handleNext();
    else handleSubmit();
  };

  const passwordAdornment = (shown, toggle, label) => (
    <InputAdornment position="end">
      <IconButton aria-label={label} onClick={toggle} edge="end">
        {shown ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthLayout title={t('register.title')} side={{ title: t('home.landing.hero.title'), text: t('register.side.text') }}>
      <Typography sx={{ color: 'text.secondary', mb: 1 }}>{t('register.step', { n: step })}</Typography>

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

      <Box component="form" onSubmit={onSubmit} noValidate>
        {step === 1 ? (
          <>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              inputRef={fieldRef('username')}
              label={t('register.username')}
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={edit(setUsername, 'username')}
              error={Boolean(fieldErrors.username)}
              helperText={fieldErrors.username || t('register.username_help')}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              inputRef={fieldRef('email')}
              label={t('register.email')}
              name="email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={edit(setEmail, 'email')}
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('register.password')}
              type={showPassword ? "text" : "password"}
              id="password"
              inputRef={fieldRef('password')}
              autoComplete="new-password"
              value={password}
              onChange={edit(setPassword, 'password')}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password}
              InputProps={{ endAdornment: passwordAdornment(showPassword, handleTogglePasswordVisibility, t('password.show')) }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label={t('register.confirm_password')}
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              inputRef={fieldRef('confirmPassword')}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={edit(setConfirmPassword, 'confirmPassword')}
              onBlur={checkConfirm}
              error={Boolean(fieldErrors.confirmPassword)}
              helperText={fieldErrors.confirmPassword}
              InputProps={{ endAdornment: passwordAdornment(showConfirmPassword, handleToggleConfirmPasswordVisibility, t('password.show_confirm')) }}
            />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, mb: 2 }} disabled={loading}>
              {loading ? t('register.checking') : t('register.next')}
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h2" sx={{ fontSize: '1.25rem', mt: 1, mb: 1 }}>{t('register.profile_title')}</Typography>
            <Typography sx={{ mb: 1 }}>{t('register.profile_text')}</Typography>
            <DateLocalization>
              <LabeledDatePicker
                label={t('register.birth_date')}
                value={birthDate}
                onChange={(newValue) => { setBirthDate(newValue); clearError('birthDate'); }}
                minDate={oldestBirthDate()}
                maxDate={subYears(startOfToday(), 14)}
                // Se la data non è ancora scelta si apre sulla vista anni, centrata su 30 anni fa (altrimenti
                // sul mese di oggi - 14 anni); poi mese e giorno. Con una data scelta si apre sul suo mese.
                views={['year', 'month', 'day']}
                openTo={birthOpenTo}
                onOpen={() => setBirthOpenTo(birthDate ? 'day' : 'year')}
                referenceDate={subYears(startOfToday(), 30)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    margin: 'normal',
                    error: Boolean(fieldErrors.birthDate),
                    helperText: fieldErrors.birthDate || t('register.birth_date_help'),
                    inputRef: fieldRef('birthDate'),
                    // MUI X ignora autoComplete di textField e lo mette a "off": passa solo da inputProps
                    inputProps: { autoComplete: 'bday' },
                    id: "birthDate",
                    name: "birthDate"
                  }
                }}
              />
              <FormControl fullWidth required margin="normal" error={Boolean(fieldErrors.gender)}>
                <InputLabel id="gender-label">{t('register.gender')}</InputLabel>
                <Select
                  labelId="gender-label"
                  inputRef={fieldRef('gender')}
                  value={gender}
                  label={t('register.gender')}
                  onChange={(e) => { setGender(e.target.value); clearError('gender'); }}
                  SelectDisplayProps={{ 'aria-describedby': fieldErrors.gender ? 'gender-error' : undefined, 'aria-invalid': fieldErrors.gender ? true : undefined }}
                >
                  <MenuItem value="M">{t('register.gender_m')}</MenuItem>
                  <MenuItem value="F">{t('register.gender_f')}</MenuItem>
                  <MenuItem value="O">{t('register.gender_o')}</MenuItem>
                </Select>
                {fieldErrors.gender && <FormHelperText id="gender-error">{fieldErrors.gender}</FormHelperText>}
              </FormControl>
              <LabeledDatePicker
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
                    margin: 'normal',
                    id: "trainingStartDate",
                    name: "trainingStartDate",
                    helperText: t('register.training_start_help')
                  }
                }}
              />
            </DateLocalization>
            <FormControl fullWidth error={Boolean(fieldErrors.terms)} sx={{ mt: 2 }}>
            <FormControlLabel
              sx={{ alignItems: 'flex-start' }}
              control={
                <Checkbox
                  checked={acceptTerms}
                  onChange={(e) => { setAcceptTerms(e.target.checked); clearError('terms'); }}
                  inputRef={fieldRef('terms')}
                  inputProps={{ 'aria-describedby': fieldErrors.terms ? 'terms-error' : undefined }}
                  // Spunta nel colore del testo: il rosso resta al bottone principale
                  sx={{ pt: 0.5, '&.Mui-checked': { color: 'text.primary' } }}
                />
              }
              label={
                <Typography>
                  <Trans
                    i18nKey="register.terms"
                    components={{
                      terms: <Link href={legalPaths(i18n.language).terms} target="_blank" rel="noopener" />,
                      privacy: <Link href={legalPaths(i18n.language).privacy} target="_blank" rel="noopener" />,
                    }}
                  />
                </Typography>
              }
            />
            {fieldErrors.terms && <FormHelperText id="terms-error">{fieldErrors.terms}</FormHelperText>}
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 3, mb: 2 }}>
              <Button color="inherit" size="large" onClick={() => { setError(''); setStep(1); }} disabled={loading}>
                {t('register.back')}
              </Button>
              <Button type="submit" variant="contained" size="large" sx={{ flex: 1 }} disabled={loading}>
                {loading ? t('register.submitting') : t('register.submit')}
              </Button>
            </Box>
          </>
        )}
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography>
            {t('register.have_account')}{' '}
            <Link component={RouterLink} to={withNext('/login')}>
              {t('register.login')}
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default Register;

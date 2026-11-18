import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  Avatar,
  TextField,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Collapse,
  Link,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import Switch from '@mui/material/Switch';
import {
  Lock as LockIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  DeleteForever as DeleteForeverIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import LabeledDatePicker from '../components/LabeledDatePicker';
import { oldestBirthDate, youngestBirthDate, isInvalidBirthDate } from '../utils/birthDate';
import { format, parseISO, startOfToday, formatDistanceToNow } from 'date-fns';
import { useTranslation, Trans } from 'react-i18next';
import DateLocalization from '../i18n/DateLocalization';
import { dateFnsLocale } from '../i18n/format';
import { DEFAULT_WEIGHT_UNIT, isWeightUnit } from '../utils/weightUnit';
import { legalPaths } from '../i18n/paths';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { validatePassword } from '../utils/passwordPolicy';
import { CHIP_FONT, TITLE_FONT_FAMILY } from '../utils/fonts';
import { NEUTRAL_OUTLINED, LINK_BUTTON } from '../utils/buttonStyles';
import useAccountDeleted from '../hooks/useAccountDeleted';
import { getConsents, setConsent } from '../utils/consent';
import useFocusField from '../hooks/useFocusField';
import useConfirmPassword from '../hooks/useConfirmPassword';
import ConfirmPasswordField from '../components/Auth/ConfirmPasswordField';
import { loginWithNext } from '../utils/safeNext';
import GroupsVisibilityCard from '../components/Groups/GroupsVisibilityCard';
import AccountTier from '../components/Account/AccountTier';
import PasswordToggle from '../components/Auth/PasswordToggle';
import ButtonSpinner from '../components/ButtonSpinner';
import DeleteAccountDialog from '../components/Account/DeleteAccountDialog';
import useDataExport from '../hooks/useDataExport';
import ChangeEmailDialog from '../components/EmailVerification/ChangeEmailDialog';
import { cancelEmailChange } from '../api/emailVerification';

const Account = ({ isEmbedded = false }) => {
  const { user, logout, isLoggedIn, updateUser, loading: authLoading, emailState, openEmailDialog, refreshEmailState } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Reindirizza al login se l'utente non è autenticato e l'autenticazione è stata verificata; dopo il login torna qui
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate(loginWithNext(location), { replace: true });
    }
  }, [isLoggedIn, authLoading, navigate, location]);

  // Stati per i dati dell'utente
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinDate, setJoinDate] = useState(null);

  // Toggle per mostrare le card "Profilo fisico" e "Allenamento", non presenti nel design
  // ma funzionalità reali: restano collassate finché l'utente non clicca "Modifica".
  const [editOpen, setEditOpen] = useState(false);

  // Stati per il profilo fisico
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [birthDateError, setBirthDateError] = useState('');
  const { fieldRef, focusField } = useFocusField();
  const [trainingStartDate, setTrainingStartDate] = useState(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Stati per la modifica della password
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const confirmPair = useConfirmPassword({ password: newPassword, confirm: confirmPassword });

  // Cambio di indirizzo email: la finestra è ChangeEmailDialog, il codice si scrive nella finestra comune (contesto)
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [cancellingChange, setCancellingChange] = useState(false);

  // Eliminazione dell'account: la finestra (con password e conferma) è DeleteAccountDialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // Stato per le impostazioni allenamento
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [locale, setLocale] = useState('it');
  const [weightUnit, setWeightUnit] = useState(DEFAULT_WEIGHT_UNIT);
  const [savingSettings, setSavingSettings] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState({ weekly_goal: null, weekly_goal_default: 3, weekly_goal_pending: null });
  const [weeklyGoalChoice, setWeeklyGoalChoice] = useState('default');

  // L'obiettivo mostrato è quello scelto per ultimo: il cambio in attesa, se c'è, altrimenti quello in vigore
  const applyWeeklyGoalSettings = useCallback((data) => {
    const settings = {
      weekly_goal: data.weekly_goal ?? null,
      weekly_goal_default: data.weekly_goal_default ?? 3,
      weekly_goal_pending: data.weekly_goal_pending ?? null,
    };
    setWeeklyGoal(settings);
    const shown = settings.weekly_goal_pending ? settings.weekly_goal_pending.goal : settings.weekly_goal;
    setWeeklyGoalChoice(shown ?? 'default');
  }, []);

  const handleWeeklyGoalChange = async (_event, next) => {
    if (next === null || next === weeklyGoalChoice) return;
    const previousSettings = weeklyGoal;
    const previousChoice = weeklyGoalChoice;
    setWeeklyGoalChoice(next);
    setSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weekly_goal: next === 'default' ? null : next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      applyWeeklyGoalSettings(data);
      setSnackbar({ open: true, message: t('account.weekly_goal.saved'), severity: 'success' });
    } catch (error) {
      console.error('Errore aggiornamento obiettivo settimanale:', error);
      setWeeklyGoal(previousSettings);
      setWeeklyGoalChoice(previousChoice);
      setSnackbar({ open: true, message: t('account.weekly_goal.error'), severity: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Eliminazione riuscita: l'esito e, dopo un breve delay, logout e home
  const handleAccountDeleted = useAccountDeleted((message, severity) => setSnackbar({ open: true, message, severity }));

  // Esportazione dati: scarica un JSON completo generato dal server (vedi useDataExport)
  const { exporting: exportLoading, download: handleDownloadData } = useDataExport(
    userData?.username,
    (message, severity) => setSnackbar({ open: true, message, severity })
  );

  // Consenso per le misure corporee (dati sulla salute): concessione e revoca. La revoca
  // cancella le misure, quindi chiede conferma e propone prima l'export.
  const [healthConsent, setHealthConsent] = useState(null); // null = non ancora caricato
  const [consentBusy, setConsentBusy] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  // Consenso dato a una versione precedente del testo: va riconfermato
  const [healthConsentOutdated, setHealthConsentOutdated] = useState(false);

  useEffect(() => {
    getConsents()
      .then((consents) => {
        setHealthConsent(consents.health_data.granted);
        setHealthConsentOutdated(!consents.health_data.granted && consents.health_data.version !== null);
      })
      .catch((error) => console.error('Errore nel caricamento dei consensi:', error));
  }, []);

  const handleHealthConsentToggle = async (checked) => {
    if (!checked) {
      setRevokeDialogOpen(true);
      return;
    }
    setConsentBusy(true);
    try {
      await setConsent('health_data', 'grant');
      setHealthConsent(true);
      setHealthConsentOutdated(false);
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    } finally {
      setConsentBusy(false);
    }
  };

  const handleConfirmRevoke = async () => {
    setConsentBusy(true);
    try {
      const result = await setConsent('health_data', 'revoke');
      setHealthConsent(false);
      setHealthConsentOutdated(false);
      setRevokeDialogOpen(false);
      setSnackbar({
        open: true,
        message: result.deleted_stats > 0
          ? t('account.consent.revoked_deleted')
          : t('account.consent.revoked'),
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    } finally {
      setConsentBusy(false);
    }
  };

  // Stato per le notifiche
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Funzione per recuperare i dati completi dell'utente
  const fetchUserData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/read.php`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('account.load_error'));
      }

      const userDetails = await response.json();

      setUserData({
        id: userDetails.id,
        username: userDetails.username,
        email: userDetails.email,
        created_at: userDetails.created_at,
        password_changed_at: userDetails.password_changed_at,
        is_admin: userDetails.is_admin === true,
        tier: userDetails.tier,
        tier_last_day: userDetails.tier_last_day,
        signup_code: userDetails.signup_code
      });

      // Impostazione dati profilo
      setAge(userDetails.age || '');
      setGender(userDetails.gender || '');
      setExperienceYears(userDetails.experience_years || '');
      setBirthDate(userDetails.birth_date ? parseISO(userDetails.birth_date) : null);
      setTrainingStartDate(userDetails.training_start_date ? parseISO(userDetails.training_start_date) : null);

      // Impostazione timer
      if (userDetails.rest_timer_enabled !== undefined) {
        setRestTimerEnabled(userDetails.rest_timer_enabled);
      }
      if (userDetails.locale) {
        setLocale(userDetails.locale);
      }
      if (isWeightUnit(userDetails.weight_unit)) {
        setWeightUnit(userDetails.weight_unit);
      }
      applyWeeklyGoalSettings(userDetails);

      if (userDetails.created_at) {
        setJoinDate(new Date(userDetails.created_at));
      } else {
        setJoinDate(new Date());
      }
    } catch (error) {
      console.error('Errore nel recupero dei dati utente:', error);
      setSnackbar({
        open: true,
        message: t('account.load_error'),
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [applyWeeklyGoalSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Caricamento dei dati dell'utente al mount del componente
  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      // Se l'utente non è autenticato, imposta loading a false per evitare il caricamento infinito
      setLoading(false);
    }
  }, [user, fetchUserData]);

  // Il livello cambia con la conferma dell'email (codice di registrazione che parte) e con l'indirizzo che diventa
  // quello dell'account: quando lo stato dell'email cambia in questo modo si rilegge solo il livello, senza far
  // tornare la pagina in caricamento
  // (Resta una seconda lettura di read.php a ogni conferma: il livello non sta in AuthContext in questa PR.)
  const lastEmailState = useRef(emailState);
  // Solo l'ultima lettura scrive; allo smontaggio il contatore avanza e una risposta in volo non scrive più
  const tierRead = useRef(0);
  useEffect(() => () => { tierRead.current += 1; }, []);
  useEffect(() => {
    const before = lastEmailState.current;
    lastEmailState.current = emailState;
    if (!before || !emailState || !user) return;
    const confirmed = !before.verified && emailState.verified;
    const addressChanged = before.email !== emailState.email;
    if (!confirmed && !addressChanged) return;
    const mine = ++tierRead.current;
    fetch(`${API_BASE_URL}api/user/read.php`, { method: 'GET', credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((details) => {
        if (!details?.success || mine !== tierRead.current) return;
        setUserData((prev) => (prev ? { ...prev, tier: details.tier, tier_last_day: details.tier_last_day, signup_code: details.signup_code } : prev));
      })
      .catch((error) => console.error('Errore nel recupero del livello:', error));
  }, [emailState, user]);

  const handleUpdateProfile = async () => {
    if (birthDate && isInvalidBirthDate(birthDate)) {
      setBirthDateError(t('birth_date.error_invalid'));
      focusField('birthDate');
      return;
    }
    setUpdatingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // Data di nascita e sesso si inviano solo se compilati: il server non li accetta vuoti
        body: JSON.stringify({
          rest_timer_enabled: restTimerEnabled,
          ...(birthDate ? { birth_date: format(birthDate, 'yyyy-MM-dd') } : {}),
          ...(gender ? { gender } : {}),
          training_start_date: trainingStartDate ? format(trainingStartDate, 'yyyy-MM-01') : null
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // Aggiorna i valori calcolati restituiti dal server
      if (data.age !== undefined) setAge(data.age);
      if (data.experience_years !== undefined) setExperienceYears(data.experience_years);

      setSnackbar({
        open: true,
        message: t('account.profile.saved'),
        severity: 'success'
      });
    } catch (error) {
      console.error('Errore aggiornamento profilo:', error);
      setSnackbar({
        open: true,
        message: t('account.profile.error'),
        severity: 'error'
      });
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Funzioni per la gestione del dialog di cambio password
  const handleOpenPasswordDialog = () => {
    setOpenPasswordDialog(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    confirmPair.reset();
  };

  const handleClosePasswordDialog = () => {
    setOpenPasswordDialog(false);
  };

  const handleChangePassword = async () => {
    confirmPair.submit();
    // Validazione
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('account.password.all_required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      // L'errore sta nella riga sotto «Conferma»: niente avviso in alto, il focus va al campo
      setPasswordError('');
      focusField('confirmPassword');
      return;
    }

    // Validazione sicurezza nuova password
    const passwordValidationError = validatePassword(newPassword);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    // Verifica che la nuova password sia diversa da quella attuale
    if (currentPassword === newPassword) {
      setPasswordError(t('account.password.same'));
      return;
    }

    setChangingPassword(true);
    setPasswordError('');

    try {
      // Password inviate in chiaro su HTTPS; l'hashing bcrypt avviene lato server
      const response = await fetch(`${API_BASE_URL}api/user/change_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
        credentials: 'include'
      });

      // Analisi della risposta
      const data = await response.json();

      if (!response.ok) {
        const failure = new Error(data.message || t('account.password.error'));
        failure.status = response.status;
        throw failure;
      }

      // Chiudiamo il dialog e mostriamo il messaggio di successo
      handleClosePasswordDialog();
      setSnackbar({
        open: true,
        message: t('account.password.changed'),
        severity: 'success'
      });

      // Aggiorna la data di ultima modifica mostrata nella card Sicurezza
      setUserData(prev => prev ? { ...prev, password_changed_at: new Date().toISOString() } : prev);
    } catch (error) {
      console.error('Errore durante il cambio password:', error);

      // Gestione dei diversi tipi di errore
      if (error.status === 401) {
        setPasswordError(t('account.session_expired'));
      } else {
        setPasswordError(error.message || t('account.password.error_retry'));
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setCancellingChange(true);
    const res = await cancelEmailChange();
    setCancellingChange(false);
    if (res.ok) {
      await refreshEmailState();
      setSnackbar({ open: true, message: t('emailstatus.cancelled'), severity: 'success' });
    } else {
      setSnackbar({ open: true, message: res.status === 0 ? t('emailconfirm.error_network') : (res.data?.message || t('emailconfirm.error_generic')), severity: 'error' });
    }
  };

  // Chiusura dello snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Rendering condizionale durante il caricamento o se l'utente non è autenticato
  if (loading || authLoading || !isLoggedIn) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Non renderizzare nulla se non c'è un utente autenticato
  if (!user) {
    return null;
  }

  const passwordChangedLabel = userData?.password_changed_at
    ? t('account.password.last_changed', { when: formatDistanceToNow(parseISO(userData.password_changed_at), { locale: dateFnsLocale(), addSuffix: true }) })
    : t('account.password.never_changed');

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      {!isEmbedded && (
        <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 22 }}>
          Il mio Account
        </Typography>
      )}

      {/* Card profilo */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: emailState?.pendingEmail ? 'flex-start' : 'center', gap: 2 }}>
          <Avatar sx={{
            width: 64, height: 64,
            bgcolor: 'ink',
            color: 'onInk',
            fontFamily: TITLE_FONT_FAMILY,
            fontWeight: 700,
            fontSize: 20,
            flexShrink: 0,
          }}>
            {userData?.username?.charAt(0).toUpperCase() || '?'}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {userData?.username || t('account.user_fallback')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {emailState?.email || userData?.email || t('account.email_unavailable')}
            </Typography>
            {emailState && (
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, mt: 0.5 }}>
                {emailState.verified ? (
                  <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 16, fontWeight: 600, color: 'success.main' }}>
                    <CheckCircleOutlineIcon aria-hidden="true" fontSize="small" />
                    {t('emailstatus.confirmed')}
                  </Typography>
                ) : (
                  <>
                    <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 16, fontWeight: 600, color: 'warning.text' }}>
                      <ErrorOutlineIcon aria-hidden="true" fontSize="small" />
                      {t('emailstatus.unconfirmed')}
                    </Typography>
                    <Button onClick={openEmailDialog} sx={LINK_BUTTON}>
                      {t('emailstatus.enter_code')}
                    </Button>
                  </>
                )}
              </Box>
            )}
            {emailState?.pendingEmail && (
              <Box sx={{ mt: 0.5 }}>
                <Typography sx={{ fontSize: 16, overflowWrap: 'anywhere' }}>
                  {t('emailstatus.pending', { email: emailState.pendingEmail })}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
                  <Button onClick={openEmailDialog} sx={LINK_BUTTON}>
                    {t('emailstatus.enter_code')}
                  </Button>
                  <Button
                    onClick={handleCancelEmailChange}
                    disabled={cancellingChange}
                    aria-label={t('emailstatus.cancel_aria')}
                    sx={LINK_BUTTON}
                  >
                    {t('common.cancel')}
                  </Button>
                </Box>
              </Box>
            )}
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.member_since', { date: joinDate ? format(joinDate, 'MMMM yyyy', { locale: dateFnsLocale() }) : t('account.date_unavailable') })}
            </Typography>
            <AccountTier tier={userData?.tier} lastDay={userData?.tier_last_day} signupCode={userData?.signup_code} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditOpen(o => !o)}
            sx={NEUTRAL_OUTLINED}
          >
            {t('account.edit')}
          </Button>
          {emailState && (
            <Button variant="outlined" onClick={() => setChangeEmailOpen(true)} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44 }}>
              {t('emailchange.open')}
            </Button>
          )}
        </Box>

        {/* Card "Profilo fisico" e "Allenamento": fuori dal design, restano collassate */}
        <Collapse in={editOpen}>
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>{t('account.physical_profile')}</Typography>
              <DateLocalization>
                <Grid container spacing={2} alignItems="flex-start">
                  <Grid item xs={12} sm={6}>
                    <LabeledDatePicker
                      label={t('account.birth_date')}
                      value={birthDate}
                      onChange={(newValue) => { setBirthDate(newValue); setBirthDateError(''); }}
                      minDate={oldestBirthDate()}
                      maxDate={youngestBirthDate()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          // undefined (non false) lascia a MUI X il suo errore di validazione (data fuori da minDate/maxDate)
                          error: birthDateError ? true : undefined,
                          inputRef: fieldRef('birthDate'),
                          // MUI X ignora autoComplete di textField e lo mette a "off": passa solo da inputProps
                          inputProps: { autoComplete: 'bday' },
                          helperText: birthDateError || (age ? t('account.age_current', { age }) : t('account.age_auto'))
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="gender-label">{t('account.gender')}</InputLabel>
                      <Select
                        labelId="gender-label"
                        value={gender}
                        label={t('account.gender')}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <MenuItem value="M">{t('account.gender_m')}</MenuItem>
                        <MenuItem value="F">{t('account.gender_f')}</MenuItem>
                        <MenuItem value="O">{t('account.gender_o')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <LabeledDatePicker
                      label={t('account.training_start')}
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
                          size: 'small',
                          helperText: experienceYears ? t('account.experience', { years: experienceYears }) : t('account.training_start_hint')
                        }
                      }}
                    />
                  </Grid>
                </Grid>
              </DateLocalization>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleUpdateProfile}
                disabled={updatingProfile}
                sx={{ fontSize: 16, mt: 2 }}
              >
                {updatingProfile ? t('focus.saving') : t('account.save_profile')}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography id="rest-timer-label" sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.rest_timer')}</Typography>
                <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
                  {t('account.rest_timer_help')}
                </Typography>
              </Box>
              <Switch
                checked={restTimerEnabled}
                inputProps={{ 'aria-labelledby': 'rest-timer-label' }}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  setRestTimerEnabled(newValue);
                  setSavingSettings(true);
                  try {
                    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ rest_timer_enabled: newValue })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);
                    setSnackbar({
                      open: true,
                      message: newValue ? t('account.rest_timer_on') : t('focus.timer_off'),
                      severity: 'success'
                    });
                  } catch (error) {
                    console.error('Errore aggiornamento impostazioni:', error);
                    setRestTimerEnabled(!newValue); // Rollback
                    setSnackbar({
                      open: true,
                      message: t('account.settings_error'),
                      severity: 'error'
                    });
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                disabled={savingSettings}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.language')}</Typography>
                <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
                  {t('account.language_help')}
                </Typography>
              </Box>
              <Select
                size="small"
                value={locale}
                disabled={savingSettings}
                inputProps={{ 'aria-label': t('account.language') }}
                onChange={async (e) => {
                  const previous = locale;
                  const next = e.target.value;
                  setLocale(next);
                  setSavingSettings(true);
                  try {
                    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ locale: next })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);
                    updateUser({ locale: next });
                    setSnackbar({ open: true, message: t('account.language_saved', { lng: next }), severity: 'success' });
                  } catch (error) {
                    console.error('Errore aggiornamento lingua:', error);
                    setLocale(previous);
                    setSnackbar({ open: true, message: t('account.language_error'), severity: 'error' });
                  } finally {
                    setSavingSettings(false);
                  }
                }}
              >
                <MenuItem value="it">Italiano</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.weight_unit')}</Typography>
                <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
                  {t('account.weight_unit_help')}
                </Typography>
              </Box>
              <Select
                size="small"
                value={weightUnit}
                disabled={savingSettings}
                inputProps={{ 'aria-label': t('account.weight_unit') }}
                onChange={async (e) => {
                  const previous = weightUnit;
                  const next = e.target.value;
                  setWeightUnit(next);
                  setSavingSettings(true);
                  try {
                    const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ weight_unit: next })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);
                    updateUser({ weight_unit: next });
                    setSnackbar({ open: true, message: t('account.weight_unit_saved'), severity: 'success' });
                  } catch (error) {
                    console.error('Errore aggiornamento unità di peso:', error);
                    setWeightUnit(previous);
                    setSnackbar({ open: true, message: t('account.weight_unit_error'), severity: 'error' });
                  } finally {
                    setSavingSettings(false);
                  }
                }}
              >
                <MenuItem value="kg">kg</MenuItem>
                <MenuItem value="lb">lb</MenuItem>
              </Select>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.weekly_goal.title')}</Typography>
                <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
                  {t('account.weekly_goal.help')}
                </Typography>
              </Box>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={weeklyGoalChoice}
                onChange={handleWeeklyGoalChange}
                disabled={savingSettings}
                aria-label={t('account.weekly_goal.title')}
                sx={{ flexWrap: 'wrap', alignSelf: 'flex-start' }}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <ToggleButton key={n} value={n} sx={{ minWidth: 40, fontSize: 16, ...CHIP_FONT }}>{n}</ToggleButton>
                ))}
                <ToggleButton value="default" sx={{ fontSize: 16, ...CHIP_FONT }}>
                  {t('account.weekly_goal.default', { n: weeklyGoal.weekly_goal_default })}
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
                {weeklyGoal.weekly_goal_pending
                  ? t('account.weekly_goal.from_date', { date: format(parseISO(weeklyGoal.weekly_goal_pending.from), 'dd/MM') })
                  : t('account.weekly_goal.now')}
              </Typography>
            </Box>
          </Box>
        </Collapse>
      </Card>

      {/* Card Sicurezza */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle">{t('account.password.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>{passwordChangedLabel}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<LockIcon />} onClick={handleOpenPasswordDialog} sx={NEUTRAL_OUTLINED}>
            {t('account.password.change')}
          </Button>
        </Box>
      </Card>

      {/* Card Dati */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle">{t('account.export.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.export.help')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={exportLoading ? <ButtonSpinner size={16} /> : <DownloadIcon />}
            onClick={handleDownloadData}
            disabled={exportLoading}
            sx={NEUTRAL_OUTLINED}
          >
            {t('account.export.button')}
          </Button>
        </Box>
      </Card>

      {/* Card Consenso misure corporee */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ maxWidth: 520 }}>
            <Typography variant="cardTitle">{t('account.consent.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.consent.help')}
            </Typography>
            {healthConsentOutdated && healthConsent !== true && (
              <Typography sx={{ fontSize: 16, color: 'warning.text', mt: 0.5 }}>
                {t('account.consent.outdated')}
              </Typography>
            )}
          </Box>
          <Switch
            checked={healthConsent === true}
            disabled={healthConsent === null || consentBusy}
            onChange={(e) => handleHealthConsentToggle(e.target.checked)}
            inputProps={{ 'aria-label': t('account.consent.aria') }}
          />
        </Box>
        <Typography sx={{ fontSize: 16, mt: 1.5 }}>
          <Link href={legalPaths(i18n.language).privacy} target="_blank" rel="noopener noreferrer">{t('account.privacy')}</Link>
          {' · '}
          <Link href={legalPaths(i18n.language).terms} target="_blank" rel="noopener noreferrer">{t('account.terms')}</Link>
        </Typography>
      </Card>

      <GroupsVisibilityCard />

      {userData?.is_admin && (
        <Card sx={{ p: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle">{t('account.admin.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('account.admin.help')}</Typography>
          </Box>
          <Button variant="outlined" onClick={() => navigate('/admin')} sx={{ ...NEUTRAL_OUTLINED, flexShrink: 0 }}>{t('account.admin.open')}</Button>
        </Card>
      )}

      {/* Sessione */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle">{t('account.session.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.session.help')}
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout} sx={NEUTRAL_OUTLINED}>
            {t('account.session.logout')}
          </Button>
        </Box>
      </Card>

      {/* Zona Pericolosa */}
      <Card sx={{ p: '24px', bgcolor: 'error.muted', border: '1px solid', borderColor: 'error.border' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="cardTitle" sx={{ color: 'error.title' }}>{t('account.danger.title')}</Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.danger.help')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setOpenDeleteDialog(true)}
            sx={{ fontSize: 16 }}
          >
            {t('account.delete.title')}
          </Button>
        </Box>
      </Card>

      {/* Dialog per cambio password */}
      <Dialog open={revokeDialogOpen} onClose={() => !consentBusy && setRevokeDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('account.revoke.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <Trans i18nKey="account.revoke.body" components={{ strong: <strong /> }} />
          </DialogContentText>
          <Button
            variant="outlined"
            startIcon={exportLoading ? <ButtonSpinner size={16} /> : <DownloadIcon />}
            onClick={handleDownloadData}
            disabled={exportLoading || consentBusy}
            sx={{ fontSize: 16 }}
          >
            {t('account.revoke.export_first')}
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRevokeDialogOpen(false)} disabled={consentBusy} sx={{ fontSize: 16 }}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmRevoke} color="error" variant="contained" disabled={consentBusy} sx={{ fontSize: 16 }}>
            {t('account.revoke.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPasswordDialog} onClose={handleClosePasswordDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('account.password.change')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('account.password.intro')}
          </DialogContentText>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}

          <TextField
            margin="dense"
            label={t('account.password.current')}
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            fullWidth
            variant="outlined"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={changingPassword}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <PasswordToggle shown={showCurrentPassword} onToggle={() => setShowCurrentPassword(!showCurrentPassword)} label={t('account.password.show_current')} disabled={changingPassword} />
              ),
            }}
          />

          <Box onBlur={confirmPair.leave}>
            <TextField
              margin="dense"
              label={t('account.password.new')}
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              fullWidth
              variant="outlined"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); confirmPair.edit(); }}
              required
              disabled={changingPassword}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <PasswordToggle shown={showNewPassword} onToggle={() => setShowNewPassword(!showNewPassword)} label={t('account.password.show_new')} disabled={changingPassword} />
                ),
              }}
            />
          </Box>

          <ConfirmPasswordField
            pair={confirmPair}
            margin="dense"
            label={t('account.password.confirm')}
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); confirmPair.edit(); }}
            inputRef={fieldRef('confirmPassword')}
            required
            disabled={changingPassword}
            InputProps={{
              endAdornment: (
                <PasswordToggle shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} label={t('password.show_confirm')} disabled={changingPassword} />
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClosePasswordDialog}
            startIcon={<CancelIcon />}
            disabled={changingPassword}
            sx={{ fontSize: 16 }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleChangePassword}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={changingPassword}
            sx={{ fontSize: 16 }}
          >
            {changingPassword ? t('focus.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ChangeEmailDialog open={changeEmailOpen} onClose={() => setChangeEmailOpen(false)} onChanged={() => openEmailDialog()} />

      <DeleteAccountDialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} onDeleted={handleAccountDeleted} />

      {/* Snackbar per notifiche */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Account;

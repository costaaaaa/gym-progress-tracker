import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Avatar,
  TextField,
  Button,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  Checkbox,
  FormControlLabel,
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
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  DeleteForever as DeleteForeverIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO, subYears, startOfToday, formatDistanceToNow } from 'date-fns';
import { useTranslation, Trans } from 'react-i18next';
import DateLocalization from '../i18n/DateLocalization';
import { dateFnsLocale } from '../i18n/format';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { validatePassword } from '../utils/passwordPolicy';
import { CHIP_FONT, TITLE_FONT_FAMILY } from '../utils/fonts';
import { NEUTRAL_OUTLINED } from '../utils/buttonStyles';
import { getConsents, setConsent } from '../utils/consent';
import GroupsVisibilityCard from '../components/Groups/GroupsVisibilityCard';

const Account = ({ isEmbedded = false }) => {
  const { user, logout, isLoggedIn, updateUser, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Reindirizza alla pagina di login se l'utente non è autenticato e l'autenticazione è stata verificata
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, authLoading, navigate]);

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

  // Stati per l'eliminazione dell'account
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Stato per l'esportazione dei dati (client-side, nessun endpoint dedicato)
  const [exportLoading, setExportLoading] = useState(false);

  // Stato per le impostazioni allenamento
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [locale, setLocale] = useState('it');
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

  // Funzioni per gestire la visibilità delle password
  const handleToggleCurrentPasswordVisibility = () => {
    setShowCurrentPassword(!showCurrentPassword);
  };

  const handleToggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Funzione per gestire la visibilità della password per l'eliminazione dell'account
  const handleToggleDeletePasswordVisibility = () => {
    setShowDeletePassword(!showDeletePassword);
  };

  // Funzioni per la gestione dell'eliminazione dell'account
  const handleOpenDeleteDialog = () => {
    setOpenDeleteDialog(true);
    setDeletePassword('');
    setDeleteConfirmed(false);
    setDeleteError('');
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
  };

  const handleDeleteAccount = async () => {
    // Validazione
    if (!deletePassword) {
      setDeleteError(t('account.delete.password_required'));
      return;
    }

    if (!deleteConfirmed) {
      setDeleteError(t('account.delete.confirm_required'));
      return;
    }

    setDeletingAccount(true);
    setDeleteError('');

    try {
      // Password inviata in chiaro su HTTPS; la verifica avviene lato server
      const response = await fetch(`${API_BASE_URL}api/user/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword
        }),
        credentials: 'include'
      });

      // Analisi della risposta
      const data = await response.json();

      if (!response.ok) {
        const failure = new Error(data.message || t('account.delete.error'));
        failure.status = response.status;
        throw failure;
      }

      // Chiudiamo il dialog e mostriamo il messaggio di successo
      handleCloseDeleteDialog();
      setSnackbar({
        open: true,
        message: t('account.delete.done'),
        severity: 'success'
      });

      // Logout e redirect alla home dopo un breve delay
      setTimeout(() => {
        logout();
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Errore durante l\'eliminazione dell\'account:', error);

      // Gestione dei diversi tipi di errore
      if (error.status === 401) {
        setDeleteError(t('account.session_expired'));
      } else {
        setDeleteError(error.message || t('account.delete.error_retry'));
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  // Esportazione dati: scarica un JSON completo generato dal server (profilo, schede, storico e
  // serie, misure, gamification, dispositivi e consensi). Ritorna true se il download e' partito.
  const handleDownloadData = async () => {
    setExportLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}api/user/export.php`, { method: 'GET', credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || t('account.export.failed'));

      const { success, ...dataToExport } = data; // eslint-disable-line no-unused-vars
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dati_liftindex_${userData?.username || 'utente'}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSnackbar({ open: true, message: t('account.export.done'), severity: 'success' });
      return true;
    } catch (error) {
      console.error('Errore nell\'esportazione dei dati:', error);
      setSnackbar({ open: true, message: t('account.export.error'), severity: 'error' });
      return false;
    } finally {
      setExportLoading(false);
    }
  };

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
        is_admin: userDetails.is_admin === true
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

  const handleUpdateProfile = async () => {
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
  };

  const handleClosePasswordDialog = () => {
    setOpenPasswordDialog(false);
  };

  const handleChangePassword = async () => {
    // Validazione
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('account.password.all_required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.password.mismatch'));
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 64, height: 64,
            bgcolor: '#1a1816',
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
              {userData?.email || t('account.email_unavailable')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
              {t('account.member_since', { date: joinDate ? format(joinDate, 'MMMM yyyy', { locale: dateFnsLocale() }) : t('account.date_unavailable') })}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setEditOpen(o => !o)}
          sx={{ ...NEUTRAL_OUTLINED, mt: 2 }}
        >
          {t('account.edit')}
        </Button>

        {/* Card "Profilo fisico" e "Allenamento": fuori dal design, restano collassate */}
        <Collapse in={editOpen}>
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>{t('account.physical_profile')}</Typography>
              <DateLocalization>
                <Grid container spacing={2} alignItems="flex-start">
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label={t('account.birth_date')}
                      value={birthDate}
                      onChange={(newValue) => setBirthDate(newValue)}
                      minDate={subYears(startOfToday(), 100)}
                      maxDate={subYears(startOfToday(), 14)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          helperText: age ? t('account.age_current', { age }) : t('account.age_auto')
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
                    <DatePicker
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
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.rest_timer')}</Typography>
                <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
                  {t('account.rest_timer_help')}
                </Typography>
              </Box>
              <Switch
                checked={restTimerEnabled}
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
            startIcon={exportLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
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
              <Typography sx={{ fontSize: 16, color: 'warning.main', mt: 0.5 }}>
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
          <Link href="/privacy.html" target="_blank" rel="noopener noreferrer">{t('account.privacy')}</Link>
          {' · '}
          <Link href="/termini.html" target="_blank" rel="noopener noreferrer">{t('account.terms')}</Link>
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
            onClick={handleOpenDeleteDialog}
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
            startIcon={exportLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
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
            fullWidth
            variant="outlined"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={changingPassword}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle current password visibility"
                    onClick={handleToggleCurrentPasswordVisibility}
                    edge="end"
                    disabled={changingPassword}
                  >
                    {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            margin="dense"
            label={t('account.password.new')}
            type={showNewPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={changingPassword}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle new password visibility"
                    onClick={handleToggleNewPasswordVisibility}
                    edge="end"
                    disabled={changingPassword}
                  >
                    {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            margin="dense"
            label={t('account.password.confirm')}
            type={showConfirmPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={changingPassword}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                    disabled={changingPassword}
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
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

      {/* Dialog per eliminazione account */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center' }}>
          <DeleteForeverIcon sx={{ mr: 1 }} /> {t('account.delete.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('account.delete.intro')}
          </DialogContentText>

          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {t('account.delete.warning_title')}
            </Typography>
            <Typography variant="body2">
              {t('account.delete.warning_text')}
            </Typography>
          </Alert>

          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}

          <TextField
            margin="dense"
            label={t('account.password.title')}
            type={showDeletePassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            required
            disabled={deletingAccount}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleToggleDeletePasswordVisibility}
                    edge="end"
                    disabled={deletingAccount}
                  >
                    {showDeletePassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                disabled={deletingAccount}
                color="error"
              />
            }
            label={t('account.delete.confirm_label')}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            startIcon={<CancelIcon />}
            disabled={deletingAccount}
            sx={{ fontSize: 16 }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteAccount}
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            disabled={deletingAccount || !deleteConfirmed}
            sx={{ fontSize: 16 }}
          >
            {deletingAccount ? t('account.delete.in_progress') : t('account.delete.title')}
          </Button>
        </DialogActions>
      </Dialog>

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

import React, { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO, subYears, startOfToday, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const Account = ({ isEmbedded = false }) => {
  const { user, logout, isLoggedIn, loading: authLoading } = useAuth();
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
  const [gender, setGender] = useState('M');
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
  const [savingSettings, setSavingSettings] = useState(false);

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
      setDeleteError('La password è obbligatoria');
      return;
    }

    if (!deleteConfirmed) {
      setDeleteError('Devi confermare di essere consapevole delle conseguenze');
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
        throw new Error(data.message || 'Errore durante l\'eliminazione dell\'account');
      }

      // Chiudiamo il dialog e mostriamo il messaggio di successo
      handleCloseDeleteDialog();
      setSnackbar({
        open: true,
        message: 'Account eliminato con successo',
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
      if (error.message.includes('password')) {
        setDeleteError('La password non è corretta');
      } else if (error.message.includes('sessione')) {
        setDeleteError('La tua sessione è scaduta. Effettua nuovamente il login.');
      } else {
        setDeleteError(error.message || 'Errore durante l\'eliminazione dell\'account. Riprova.');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  // Esportazione dati: scarica subito schede + storico + misure in JSON, nessun dialog di selezione.
  const handleDownloadData = async () => {
    setExportLoading(true);

    try {
      const [workoutResponse, plansResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}api/workout_history/read.php`, { method: 'GET', credentials: 'include' }),
        fetch(`${API_BASE_URL}api/workout/read_plans.php`, { method: 'GET', credentials: 'include' }),
        fetch(`${API_BASE_URL}api/user_stats/read.php`, { method: 'GET', credentials: 'include' }),
      ]);

      const workoutJson = workoutResponse.ok ? await workoutResponse.json() : null;
      const plansJson = plansResponse.ok ? await plansResponse.json() : null;
      const statsJson = statsResponse.ok ? await statsResponse.json() : null;

      const dataToExport = {
        utente: {
          username: userData?.username,
          email: userData?.email,
          data_esportazione: new Date().toISOString()
        },
        allenamenti: Array.isArray(workoutJson?.records) ? workoutJson.records : [],
        schede: Array.isArray(plansJson?.records) ? plansJson.records : [],
        misure: Array.isArray(statsJson?.records) ? statsJson.records : [],
      };

      const jsonData = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dati_fitness_${userData?.username || 'utente'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSnackbar({
        open: true,
        message: 'Download completato con successo',
        severity: 'success'
      });
    } catch (error) {
      console.error('Errore nell\'esportazione dei dati:', error);
      setSnackbar({
        open: true,
        message: 'Errore nell\'esportazione dei dati',
        severity: 'error'
      });
    } finally {
      setExportLoading(false);
    }
  };

  // Stato per le notifiche
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Caricamento dei dati dell'utente al mount del componente
  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      // Se l'utente non è autenticato, imposta loading a false per evitare il caricamento infinito
      setLoading(false);
    }
  }, [user]);

  // Funzione per recuperare i dati completi dell'utente
  const fetchUserData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/read.php`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Errore nel recupero dei dati utente');
      }

      const userDetails = await response.json();

      setUserData({
        id: userDetails.id,
        username: userDetails.username,
        email: userDetails.email,
        created_at: userDetails.created_at,
        password_changed_at: userDetails.password_changed_at
      });

      // Impostazione dati profilo
      setAge(userDetails.age || '');
      setGender(userDetails.gender || 'M');
      setExperienceYears(userDetails.experience_years || '');
      setBirthDate(userDetails.birth_date ? parseISO(userDetails.birth_date) : null);
      setTrainingStartDate(userDetails.training_start_date ? parseISO(userDetails.training_start_date) : null);

      // Impostazione timer
      if (userDetails.rest_timer_enabled !== undefined) {
        setRestTimerEnabled(userDetails.rest_timer_enabled);
      }

      if (userDetails.created_at) {
        setJoinDate(new Date(userDetails.created_at));
      } else {
        setJoinDate(new Date());
      }
    } catch (error) {
      console.error('Errore nel recupero dei dati utente:', error);
      setSnackbar({
        open: true,
        message: 'Errore nel caricamento dei dati utente',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setUpdatingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user/update_settings.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rest_timer_enabled: restTimerEnabled,
          birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : null,
          gender: gender,
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
        message: 'Profilo aggiornato con successo',
        severity: 'success'
      });
    } catch (error) {
      console.error('Errore aggiornamento profilo:', error);
      setSnackbar({
        open: true,
        message: 'Errore nel salvataggio del profilo',
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

  // Validazione sicurezza password
  const validatePassword = (pass) => {
    const minLength = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*]/.test(pass);

    if (!minLength) return "La password deve contenere almeno 8 caratteri";
    if (!hasUpper) return "La password deve contenere almeno una lettera maiuscola";
    if (!hasLower) return "La password deve contenere almeno una lettera minuscola";
    if (!hasNumber) return "La password deve contenere almeno un numero";
    if (!hasSpecial) return "La password deve contenere almeno un carattere speciale (!@#$%^&*)";
    return null;
  };

  const handleChangePassword = async () => {
    // Validazione
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tutti i campi sono obbligatori');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Le nuove password non corrispondono');
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
      setPasswordError('La nuova password deve essere diversa da quella attuale');
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
        throw new Error(data.message || 'Errore durante il cambio password');
      }

      // Chiudiamo il dialog e mostriamo il messaggio di successo
      handleClosePasswordDialog();
      setSnackbar({
        open: true,
        message: 'Password modificata con successo',
        severity: 'success'
      });

      // Aggiorna la data di ultima modifica mostrata nella card Sicurezza
      setUserData(prev => prev ? { ...prev, password_changed_at: new Date().toISOString() } : prev);
    } catch (error) {
      console.error('Errore durante il cambio password:', error);

      // Gestione dei diversi tipi di errore
      if (error.message.includes('password attuale')) {
        setPasswordError('La password attuale non è corretta');
      } else if (error.message.includes('sessione')) {
        setPasswordError('La tua sessione è scaduta. Effettua nuovamente il login.');
      } else {
        setPasswordError(error.message || 'Errore durante il cambio password. Riprova.');
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
    ? `Ultima modifica ${formatDistanceToNow(parseISO(userData.password_changed_at), { locale: it, addSuffix: true })}`
    : 'Non ancora modificata';

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      {!isEmbedded && (
        <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 22 }}>
          Il mio Account
        </Typography>
      )}

      {/* Card profilo */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{
            width: 64, height: 64,
            bgcolor: '#1a1816',
            fontFamily: '"Lexend", sans-serif',
            fontWeight: 700,
            fontSize: 20,
            flexShrink: 0,
          }}>
            {userData?.username?.charAt(0).toUpperCase() || '?'}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }} noWrap>
              {userData?.username || 'Utente'}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }} noWrap>
              {userData?.email || 'Email non disponibile'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              Membro da {joinDate ? format(joinDate, 'MMMM yyyy', { locale: it }) : 'data non disponibile'}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditOpen(o => !o)}
            sx={{ flexShrink: 0 }}
          >
            Modifica
          </Button>
        </Box>

        {/* Card "Profilo fisico" e "Allenamento": fuori dal design, restano collassate */}
        <Collapse in={editOpen}>
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5 }}>Profilo fisico</Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
                <Grid container spacing={2} alignItems="flex-start">
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
                          size: 'small',
                          helperText: age ? `Età attuale: ${age} anni` : 'Calcolata automaticamente'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="gender-label">Sesso</InputLabel>
                      <Select
                        labelId="gender-label"
                        value={gender}
                        label="Sesso"
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <MenuItem value="M">Maschio</MenuItem>
                        <MenuItem value="F">Femmina</MenuItem>
                        <MenuItem value="O">Altro</MenuItem>
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
                          size: 'small',
                          helperText: experienceYears ? `Esperienza: ${experienceYears} anni` : 'Mese e anno di inizio'
                        }
                      }}
                    />
                  </Grid>
                </Grid>
              </LocalizationProvider>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleUpdateProfile}
                disabled={updatingProfile}
                sx={{ mt: 2 }}
              >
                {updatingProfile ? 'Salvataggio...' : 'Salva Profilo'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Timer di recupero</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                  Disattiva se usi un timer dedicato o l'orologio della palestra
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
                      message: newValue ? 'Timer di recupero attivato' : 'Timer di recupero disattivato',
                      severity: 'success'
                    });
                  } catch (error) {
                    console.error('Errore aggiornamento impostazioni:', error);
                    setRestTimerEnabled(!newValue); // Rollback
                    setSnackbar({
                      open: true,
                      message: 'Errore nel salvataggio delle impostazioni',
                      severity: 'error'
                    });
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                disabled={savingSettings}
                color="primary"
              />
            </Box>
          </Box>
        </Collapse>
      </Card>

      {/* Card Sicurezza */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Password</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{passwordChangedLabel}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<LockIcon />} onClick={handleOpenPasswordDialog}>
            Cambia Password
          </Button>
        </Box>
      </Card>

      {/* Card Dati */}
      <Card sx={{ p: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Esporta i tuoi dati</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              Scarica schede, storico e misure in formato JSON
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={exportLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleDownloadData}
            disabled={exportLoading}
          >
            Esporta
          </Button>
        </Box>
      </Card>

      {/* Zona Pericolosa */}
      <Card sx={{
        p: '24px',
        borderRadius: '16px',
        bgcolor: (theme) => theme.palette.mode === 'light' ? '#fdf3f3' : 'rgba(213, 0, 0, 0.08)',
        border: (theme) => theme.palette.mode === 'light' ? '1px solid #f5c6c6' : '1px solid rgba(213, 0, 0, 0.3)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{
              fontFamily: '"Lexend", sans-serif',
              fontWeight: 700,
              fontSize: 15,
              color: (theme) => theme.palette.mode === 'light' ? '#9b0000' : 'error.main',
            }}>
              Zona Pericolosa
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              Elimina definitivamente il tuo account e tutti i tuoi dati
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={handleOpenDeleteDialog}
          >
            Elimina Account
          </Button>
        </Box>
      </Card>

      {/* Dialog per cambio password */}
      <Dialog open={openPasswordDialog} onClose={handleClosePasswordDialog} fullWidth maxWidth="sm">
        <DialogTitle>Cambia Password</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Per modificare la tua password, inserisci la password attuale seguita dalla nuova password.
          </DialogContentText>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}

          <TextField
            margin="dense"
            label="Password Attuale"
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
            label="Nuova Password"
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
            label="Conferma Nuova Password"
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
          >
            Annulla
          </Button>
          <Button
            onClick={handleChangePassword}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={changingPassword}
          >
            {changingPassword ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog per eliminazione account */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center' }}>
          <DeleteForeverIcon sx={{ mr: 1 }} /> Elimina Account
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Stai per eliminare definitivamente il tuo account. Questa operazione non può essere annullata e comporterà la perdita di tutti i tuoi dati.
          </DialogContentText>

          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Attenzione: questa azione è irreversibile!
            </Typography>
            <Typography variant="body2">
              Tutti i tuoi dati, inclusi allenamenti e schede, verranno eliminati permanentemente.
            </Typography>
          </Alert>

          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}

          <TextField
            margin="dense"
            label="Password"
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
            label="Confermo di essere consapevole che tutti i miei dati verranno eliminati permanentemente"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            startIcon={<CancelIcon />}
            disabled={deletingAccount}
          >
            Annulla
          </Button>
          <Button
            onClick={handleDeleteAccount}
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            disabled={deletingAccount || !deleteConfirmed}
          >
            {deletingAccount ? 'Eliminazione in corso...' : 'Elimina Account'}
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

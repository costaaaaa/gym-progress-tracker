import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Box, 
  Grid, 
  Avatar, 
  TextField,
  Button,
  Divider,
  Card,
  CardContent,
  Skeleton,
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormGroup,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import Switch from '@mui/material/Switch';
import { 
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  FitnessCenter as FitnessCenterIcon,
  CalendarToday as CalendarIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  DeleteForever as DeleteForeverIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  FileDownload as FileDownloadIcon,
  History as HistoryIcon,
  Description as DescriptionIcon,
  Timer as TimerIcon,
  Wc as WcIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import SHA256 from 'crypto-js/sha256';

const Account = () => {
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
  const [workoutCount, setWorkoutCount] = useState(0);
  const [joinDate, setJoinDate] = useState(null);
  
  // Stati per il profilo fisico
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('M');
  const [experienceYears, setExperienceYears] = useState('');
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
  
  // Stati per l'esportazione dei dati
  const [openExportDialog, setOpenExportDialog] = useState(false);
  const [exportWorkouts, setExportWorkouts] = useState(true);
  const [exportPlans, setExportPlans] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [workoutData, setWorkoutData] = useState([]);
  const [plansData, setPlansData] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  
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
      // Generiamo l'hash della password
      const passwordHash = SHA256(deletePassword).toString();
      
      // Chiamata API al backend (da implementare nel backend)
      const response = await fetch(`${API_BASE_URL}api/user/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: passwordHash,
          is_hashed: true
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
  
  // Funzioni per la gestione dell'esportazione dei dati
  const handleOpenExportDialog = () => {
    setOpenExportDialog(true);
    setExportWorkouts(true);
    setExportPlans(true);
    // Non resettiamo tutto qui per permettere all'utente di riprovare senza ricaricare
  };
  
  const handleCloseExportDialog = () => {
    setOpenExportDialog(false);
    // Resettiamo i dati caricati per liberare memoria se il download è finito o annullato
    setDataLoaded(false);
    setWorkoutData([]);
    setPlansData([]);
  };
  
const fetchExportData = React.useCallback(async () => {
  setExportLoading(true);
  
  try {
    let loadedWorkouts = [];
    let loadedPlans = [];

    // Recupero dati allenamenti
    if (exportWorkouts) {
      const workoutResponse = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (workoutResponse.ok) {
        const data = await workoutResponse.json();
        if (data.records && Array.isArray(data.records)) {
          loadedWorkouts = data.records;
          setWorkoutData(data.records);
        }
      }
    }
    
    // Recupero dati schede
    if (exportPlans) {
      const plansResponse = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (plansResponse.ok) {
        const data = await plansResponse.json();
        if (data.records && Array.isArray(data.records)) {
          loadedPlans = data.records;
          setPlansData(data.records);
        }
      }
    }
    
    setDataLoaded(true);
    return { workouts: loadedWorkouts, plans: loadedPlans };
  } catch (error) {
    console.error('Errore nel recupero dei dati per l\'esportazione:', error);
    setSnackbar({
      open: true,
      message: 'Errore nel recupero dei dati per l\'esportazione',
      severity: 'error'
    });
    return null;
  } finally {
    setExportLoading(false);
  }
}, [exportWorkouts, exportPlans, setWorkoutData, setPlansData, setDataLoaded, setExportLoading]);
  
  // Funzione per scaricare i dati selezionati
  const handleDownloadData = async () => {
    let currentWorkoutData = workoutData;
    let currentPlansData = plansData;

    // Se i dati non sono caricati, li scarichiamo ora
    if (!dataLoaded) {
      const results = await fetchExportData();
      if (!results) return;
      currentWorkoutData = results.workouts;
      currentPlansData = results.plans;
    }

    // Prepara i dati da scaricare
    const dataToExport = {
      utente: {
        username: userData?.username,
        email: userData?.email,
        data_esportazione: new Date().toISOString()
      }
    };
    
    if (exportWorkouts) {
      dataToExport.allenamenti = currentWorkoutData;
    }
    
    if (exportPlans) {
      dataToExport.schede = currentPlansData;
    }
    
    // Converti in JSON
    const jsonData = JSON.stringify(dataToExport, null, 2);
    
    // Crea un blob e un link per il download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dati_fitness_${userData?.username || 'utente'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Mostra notifica di successo
    setSnackbar({
      open: true,
      message: 'Download completato con successo',
      severity: 'success'
    });
    
    // Chiudi il dialog
    handleCloseExportDialog();
  };
  
  // Effetto per caricare i dati rimosso (ora on-demand)
  
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
      fetchWorkoutCount();
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
        created_at: userDetails.created_at
      });

      // Impostazione dati profilo
      setAge(userDetails.age || '');
      setGender(userDetails.gender || 'M');
      setExperienceYears(userDetails.experience_years || '');

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
  
  // Funzione per recuperare il conteggio degli allenamenti
  const fetchWorkoutCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/workout_stats/total_count.php`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Errore nel recupero del conteggio allenamenti');
      }

      const data = await response.json();
      if (data.success) {
        setWorkoutCount(data.total);
      } else {
        setWorkoutCount(0);
      }
    } catch (error) {
      console.error('Errore nel conteggio degli allenamenti:', error);
      setWorkoutCount(0);
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
          age: age === '' ? null : parseInt(age),
          gender: gender,
          experience_years: experienceYears === '' ? null : parseFloat(experienceYears)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

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
    
    if (newPassword.length < 8) {
      setPasswordError('La nuova password deve essere lunga almeno 8 caratteri');
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
      // Generiamo gli hash delle password
      const currentPasswordHash = SHA256(currentPassword).toString();
      const newPasswordHash = SHA256(newPassword).toString();
      
      // Chiamata API al backend
      const response = await fetch(`${API_BASE_URL}api/user/change_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPasswordHash,
          new_password: newPasswordHash,
          is_hashed: true
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
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Skeleton variant="circular" width={60} height={60} sx={{ mr: 2 }} />
            <Box>
              <Skeleton variant="text" width={150} height={40} />
              <Skeleton variant="text" width={220} height={24} />
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Skeleton variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 1 }} />
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Skeleton variant="rectangular" height={170} sx={{ borderRadius: 1 }} />
            </Grid>
          </Grid>
        </Paper>
      </Container>
    );
  }
  
  // Non renderizzare nulla se non c'è un utente autenticato
  if (!user) {
    return null;
  }
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ 
        fontWeight: 700,
        mb: 3,
        textAlign: { xs: 'center', sm: 'left' },
        fontSize: { xs: '1.8rem', sm: '2.125rem' }
      }}>
        Il mio Account
      </Typography>
      
      <Paper elevation={3} sx={{ 
        p: { xs: 2, sm: 3, md: 4 }, 
        borderRadius: 2,
        mb: 4,
        background: (theme) => theme.palette.mode === 'light' 
          ? 'linear-gradient(to right bottom, #ffffff, #f8f9fa)'
          : 'linear-gradient(to right bottom, #141416, #1a1a1b)',
        border: (theme) => theme.palette.mode === 'light' ? 'none' : '1px solid rgba(255,255,255,0.05)'
      }}>
        {/* Intestazione con avatar e nome utente */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'flex-start' },
          mb: 3 
        }}>
          <Avatar 
            sx={{ 
              width: { xs: 80, sm: 100 }, 
              height: { xs: 80, sm: 100 },
              bgcolor: 'primary.main',
              mb: { xs: 2, sm: 0 },
              mr: { xs: 0, sm: 3 },
              fontSize: { xs: '2rem', sm: '2.5rem' },
              boxShadow: (theme) => theme.palette.mode === 'light' ? '0 4px 12px rgba(213, 0, 0, 0.2)' : '0 4px 20px rgba(0, 0, 0, 0.4)'
            }}
          >
            {userData?.username?.charAt(0).toUpperCase() || <PersonIcon fontSize="large" />}
          </Avatar>
          
          <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
            <Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
              {userData?.username || 'Utente'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <EmailIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              {userData?.email || 'Email non disponibile'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ 
              mt: 1, 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: { xs: 'center', sm: 'flex-start' }
            }}>
              <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Iscritto dal {joinDate ? format(joinDate, 'd MMMM yyyy', { locale: it }) : 'Non disponibile'}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        {/* Statistiche */}
        <Grid container spacing={3}>
          {/* Colonna informazioni */}
          <Grid item xs={12} sm={6}>
            <Typography variant="h6" gutterBottom sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mb: 2
            }}>
              <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
              Informazioni Personali
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Username
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {userData?.username || 'Non disponibile'}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Email
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {userData?.email || 'Non disponibile'}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom sx={{ 
              fontWeight: 'bold', 
              mt: 1, 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center'
            }}>
              <FitnessCenterIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
              Profilo Fisico ed Esperienza
            </Typography>

            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
              border: '1px border',
              borderColor: 'divider',
              mb: 2
            }}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Età"
                    type="number"
                    fullWidth
                    size="small"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    sx={{
                      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                        display: 'none',
                      },
                      '& input[type=number]': {
                        MozAppearance: 'textfield',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
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
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Anni Esperienza"
                    type="number"
                    fullWidth
                    size="small"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    inputProps={{ step: 0.5 }}
                    sx={{
                      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                        display: 'none',
                      },
                      '& input[type=number]': {
                        MozAppearance: 'textfield',
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleUpdateProfile}
              disabled={updatingProfile}
              sx={{ mb: 3 }}
              fullWidth
            >
              {updatingProfile ? 'Salvataggio...' : 'Salva Profilo'}
            </Button>
            
            <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, flexWrap: 'wrap', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={handleOpenPasswordDialog}
                fullWidth={false}
              >
                Cambia Password
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleOpenExportDialog}
                color="primary"
                fullWidth={false}
              >
                Esporta Dati
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<DeleteForeverIcon />}
                onClick={handleOpenDeleteDialog}
                color="error"
                fullWidth={false}
              >
                Elimina Account
              </Button>
            </Box>
          </Grid>
          
          {/* Colonna statistiche */}
          <Grid item xs={12} sm={6}>
            <Typography variant="h6" gutterBottom sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mb: 2
            }}>
              <FitnessCenterIcon sx={{ mr: 1, color: 'primary.main' }} />
              Le tue Statistiche
            </Typography>
            
            <Card sx={{ 
              mb: 2, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.04)' : 'rgba(213, 0, 0, 0.08)',
              border: (theme) => theme.palette.mode === 'light' ? '1px solid rgba(25, 118, 210, 0.12)' : '1px solid rgba(213, 0, 0, 0.2)'
            }}>
              <CardContent>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                  Allenamenti Totali
                </Typography>
                <Typography variant="h3" component="div" color="primary.main" fontWeight="bold">
                  {workoutCount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Allenamenti registrati sulla piattaforma
                </Typography>
              </CardContent>
            </Card>
            
            <Card sx={{ 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(76, 175, 80, 0.04)' : 'rgba(76, 175, 80, 0.08)',
              border: (theme) => theme.palette.mode === 'light' ? '1px solid rgba(76, 175, 80, 0.12)' : '1px solid rgba(76, 175, 80, 0.2)'
            }}>
              <CardContent>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                  Data Iscrizione
                </Typography>
                <Typography variant="h5" component="div" color="success.main" fontWeight="bold">
                  {joinDate ? format(joinDate, 'd MMMM yyyy', { locale: it }) : 'Non disponibile'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {joinDate ? `Utente da ${Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24))} giorni` : ''}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Sezione Impostazioni Allenamento */}
      <Paper elevation={3} sx={{ 
        p: { xs: 2, sm: 3, md: 4 }, 
        borderRadius: 2,
        mb: 4,
        background: (theme) => theme.palette.mode === 'light' 
          ? 'linear-gradient(to right bottom, #ffffff, #f8f9fa)'
          : 'linear-gradient(to right bottom, #141416, #1a1a1b)',
        border: (theme) => theme.palette.mode === 'light' ? 'none' : '1px solid rgba(255,255,255,0.05)'
      }}>
        <Typography variant="h6" gutterBottom sx={{ 
          display: 'flex', 
          alignItems: 'center',
          mb: 2
        }}>
          <TimerIcon sx={{ mr: 1, color: 'primary.main' }} />
          Impostazioni Allenamento
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          borderRadius: 2,
          bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.04)' : 'rgba(255, 255, 255, 0.03)',
          border: (theme) => theme.palette.mode === 'light' ? '1px solid rgba(25, 118, 210, 0.12)' : '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="medium">
              Timer di recupero
            </Typography>
            <Typography variant="body2" color="text.secondary">
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
      </Paper>
      
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
      
      {/* Dialog per esportazione dati */}
      <Dialog open={openExportDialog} onClose={handleCloseExportDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <FileDownloadIcon sx={{ mr: 1 }} /> Esporta i tuoi dati
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Seleziona quali dati desideri esportare. I dati verranno scaricati in formato JSON.
          </DialogContentText>
          
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={exportWorkouts}
                  onChange={(e) => setExportWorkouts(e.target.checked)}
                  disabled={exportLoading}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography>Cronologia Allenamenti ({workoutData.length || workoutCount})</Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={exportPlans}
                  onChange={(e) => setExportPlans(e.target.checked)}
                  disabled={exportLoading}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography>Schede di Allenamento ({plansData.length})</Typography>
                </Box>
              }
            />
          </FormGroup>
          
          {exportLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress size={30} sx={{ color: 'primary.main' }} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Preparazione dei dati in corso...
              </Typography>
            </Box>
          )}
          
          {dataLoaded && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Dati pronti per il download:
              </Typography>
              
              <List dense>
                {exportWorkouts && workoutData.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <HistoryIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${workoutData.length} allenamenti`}
                      secondary="Cronologia completa dei tuoi allenamenti"
                    />
                  </ListItem>
                )}
                
                {exportPlans && plansData.length > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <DescriptionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${plansData.length} schede di allenamento`}
                      secondary="Le tue schede personalizzate"
                    />
                  </ListItem>
                )}
                
                {((exportWorkouts && workoutData.length === 0) || (exportPlans && plansData.length === 0)) && (
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Nessun dato disponibile per alcune selezioni"
                      secondary="Seleziona altre opzioni o verifica di avere dati salvati"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCloseExportDialog} 
            startIcon={<CancelIcon />}
            disabled={exportLoading}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleDownloadData} 
            variant="contained" 
            color="primary"
            startIcon={<FileDownloadIcon />}
            disabled={exportLoading || !dataLoaded || (!exportWorkouts && !exportPlans) || 
              (exportWorkouts && workoutData.length === 0 && exportPlans && plansData.length === 0)}
          >
            Scarica Dati
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
    </Container>
  );
};

export default Account;
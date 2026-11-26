import { useState, useEffect } from 'react';
import { Box, Snackbar, Alert, CircularProgress } from '@mui/material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSnackbarAboveBar } from '../hooks/useSnackbarAboveBar';
import { loginWithNext } from '../utils/safeNext';
import useAccount from './account/useAccount';

// Cornice dell'Account (la rotta /account, che ha per figlie l'elenco e le sue pagine): accesso, lettura dei dati e
// notifica, una volta sola per tutte. Alle pagine passa `account`, `joinDate`, `notify` e `patchAccount` (Outlet context):
// dopo un salvataggio riuscito una pagina mette i campi salvati in `account`, così chi rientra vede il valore nuovo.
const Account = () => {
  const noticeSx = useSnackbarAboveBar();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Reindirizza al login se l'utente non è autenticato e l'autenticazione è stata verificata; dopo il login torna qui
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate(loginWithNext(location), { replace: true });
    }
  }, [isLoggedIn, authLoading, navigate, location]);

  // Stato per le notifiche
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Esito di ogni salvataggio e cambio dei pezzi delle pagine: annuncio e errore nella notifica della cornice
  const notify = (message, severity) => setSnackbar({ open: true, message, severity });

  const { account, joinDate, loading, patchAccount } = useAccount(notify);

  // Chiusura dello snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // L'attesa a pagina intera è solo alla prima lettura: quando i dati si rileggono (cambia l'utente) le pagine restano
  // montate, con le loro finestre aperte e i loro stati, e ricevono i dati nuovi
  if ((loading && !account) || authLoading || !isLoggedIn) {
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

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', pb: 4 }}>
      <Outlet context={{ account, joinDate, notify, patchAccount }} />

      {/* Snackbar per notifiche */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={noticeSx}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Account;

import { useState, useEffect } from 'react';
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import { loginWithNext } from '../utils/safeNext';
import GroupsVisibilityCard from '../components/Groups/GroupsVisibilityCard';
import ModulesCard from '../components/Account/ModulesCard';
import useAccount from './account/useAccount';
import ProfileCard from './account/ProfileCard';
import PhysicalProfileForm from './account/PhysicalProfileForm';
import FocusToolsSetting from './account/FocusToolsSetting';
import LanguageSetting from './account/LanguageSetting';
import WeightUnitSetting from './account/WeightUnitSetting';
import WeeklyGoalSetting from './account/WeeklyGoalSetting';
import PasswordCard from './account/PasswordCard';
import ExportCard from './account/ExportCard';
import ConsentCard from './account/ConsentCard';
import AdminCard from './account/AdminCard';
import SessionCard from './account/SessionCard';
import DeleteAccountCard from './account/DeleteAccountCard';

const Account = () => {
  const { t } = useTranslation();
  usePageMeta(t('account.title'), t('account.meta.description'));
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

  // Esito di ogni salvataggio e cambio dei pezzi della pagina: annuncio e errore nella notifica della pagina
  const notify = (message, severity) => setSnackbar({ open: true, message, severity });

  const { account, joinDate, loading } = useAccount(notify);

  // La parte «Modifica» del profilo sta qui e non nella card: quando cambia l'utente la lettura rimette la pagina in
  // caricamento e smonta i pezzi, e una parte aperta non deve richiudersi
  const [editOpen, setEditOpen] = useState(false);

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

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      <Typography variant="pageTitle">{t('account.title')}</Typography>

      <ProfileCard account={account} joinDate={joinDate} notify={notify} editOpen={editOpen} onToggleEdit={() => setEditOpen(o => !o)}>
        <PhysicalProfileForm account={account} notify={notify} />
        <FocusToolsSetting notify={notify} />
        <LanguageSetting account={account} notify={notify} />
        <WeightUnitSetting account={account} notify={notify} />
        <WeeklyGoalSetting account={account} notify={notify} />
      </ProfileCard>

      {/* Card Moduli */}
      <ModulesCard notify={notify} />

      <PasswordCard account={account} notify={notify} />

      <ExportCard username={account?.username} notify={notify} />

      <ConsentCard username={account?.username} notify={notify} />

      <GroupsVisibilityCard notify={notify} />

      {account?.is_admin && <AdminCard />}

      <SessionCard />

      <DeleteAccountCard notify={notify} />

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

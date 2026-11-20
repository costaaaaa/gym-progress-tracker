import { useEffect, useRef, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { hasFocusSessionInProgress } from '../../utils/focusDraft';
import InterestsGate from '../Modules/InterestsGate';
import EmailConfirmDialog from './EmailConfirmDialog';

// Giorno di calendario locale dell'ultima volta che la finestra del codice è stata mostrata, per utente
const reminderKey = (userId) => `lx_email_reminder_${userId}`;
const localDay = () => format(new Date(), 'yyyy-MM-dd');

// localStorage può lanciare (modalità privata, spazio pieno, accesso negato): la scrittura si ignora (il promemoria
// si valuta comunque una volta sola per caricamento della pagina) e, se la lettura fallisce, vale come già mostrato
// oggi: meglio un promemoria in meno che uno a ogni apertura
const shownToday = (userId) => {
  try {
    return localStorage.getItem(reminderKey(userId)) === localDay();
  } catch {
    return true;
  }
};
const markShownToday = (userId) => {
  try {
    localStorage.setItem(reminderKey(userId), localDay());
  } catch {
    // niente da fare: al prossimo caricamento il promemoria potrà ripresentarsi
  }
};

// Montato una volta sola nel layout, fuori dalla pagina. Tiene:
//  - la finestra del codice (aperta dal contesto: registrazione, striscia, Account, promemoria);
//  - il promemoria all'apertura dell'app, al massimo una volta per giorno e mai su un allenamento Focus in corso;
//  - la schermata «Cosa ti interessa?», che aspetta la chiusura dell'avviso di esito;
//  - l'avviso di esito (con un codice di registrazione, il messaggio del server), quando lo stato passa a «confermata» o l'indirizzo in attesa diventa quello dell'account.
// Con l'app bloccata non c'è la finestra: il codice si scrive nella schermata di blocco.
const EmailGate = () => {
  const { t } = useTranslation();
  const { isLoggedIn, user, emailState, emailDialogOpen, openEmailDialog, closeEmailDialog, claimEmailReminder } = useAuth();
  const [notice, setNotice] = useState('');

  const userId = user?.id;
  const needsCode = Boolean(emailState && (!emailState.verified || emailState.pendingEmail));
  const dialogOpen = Boolean(isLoggedIn && emailDialogOpen && needsCode && !emailState.blocked);

  // Ogni volta che la finestra è davanti all'utente (anche aperta da lui) conta come mostrata oggi
  useEffect(() => {
    if (dialogOpen && userId) markShownToday(userId);
  }, [dialogOpen, userId]);

  // Promemoria: si valuta una volta per apertura dell'app, appena lo stato è noto
  useEffect(() => {
    if (!isLoggedIn || !userId || !emailState || emailState.verified || emailState.blocked) return;
    if (!claimEmailReminder()) return;
    if (hasFocusSessionInProgress()) return; // rimandato all'apertura successiva
    if (shownToday(userId)) return;
    openEmailDialog();
  }, [isLoggedIn, userId, emailState, claimEmailReminder, openEmailDialog]);

  // Un flag rimasto acceso quando non c'è più nulla da scrivere (confermata altrove) non deve riaprire la finestra
  useEffect(() => {
    if (emailState && !needsCode && emailDialogOpen) closeEmailDialog();
  }, [emailState, needsCode, emailDialogOpen, closeEmailDialog]);

  // Esito: dal confronto con lo stato precedente, così vale per ogni strada (finestra, schermata di blocco, Account)
  const previous = useRef(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = emailState;
    if (!before || !emailState) return;
    if (!before.verified && emailState.verified) {
      setNotice(emailState.outcome || t('emailconfirm.done'));
    } else if (before.pendingEmail && !emailState.pendingEmail && emailState.email === before.pendingEmail) {
      setNotice(t('emailconfirm.done_changed', { email: emailState.email }));
    }
  }, [emailState, t]);

  return (
    <>
      <EmailConfirmDialog open={dialogOpen} onClose={closeEmailDialog} onConfirmed={closeEmailDialog} />
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // Sopra la barra in basso del telefono
        sx={{ bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 24 } }}
      >
        <Alert onClose={() => setNotice('')} severity="success" sx={{ width: '100%' }}>{notice}</Alert>
      </Snackbar>
      {/* «Cosa ti interessa?» arriva dopo l'avviso di esito: si apre quando l'avviso si è chiuso */}
      <InterestsGate waiting={Boolean(notice)} />
    </>
  );
};

export default EmailGate;

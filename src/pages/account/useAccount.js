import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';

// I dati dell'account, dalla lettura di user/read.php: `account` (la risposta del server; null finché non arriva o se la
// lettura fallisce), `joinDate` (data di iscrizione; oggi se il server non la manda) e `loading`. Se la lettura fallisce
// l'errore va a notify(message, severity). Si rilegge quando cambia l'utente di AuthContext. `patchAccount(patch)` unisce
// dei campi dentro `account` dopo un salvataggio riuscito, così le pagine rivedono il valore nuovo senza una nuova
// lettura; unisce sempre, anche se `account` è null (ne nasce uno con i soli campi salvati: le pagine leggono ogni campo
// con `account?.x`). Una lettura partita prima di una `patchAccount` e arrivata dopo non la cancella: le modifiche fatte
// mentre una lettura è in corso si riapplicano sopra la sua risposta. Non sa nulla di come le pagine mostrano i dati.
export default function useAccount(notify) {
  const { user, emailState } = useAuth();
  const { t } = useTranslation();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinDate, setJoinDate] = useState(null);
  // notify cambia a ogni disegno di chi chiama: la lettura non deve ripartire per questo
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  // Le modifiche di patchAccount fatte mentre almeno una lettura è in corso; vuoto quando nessuna lo è
  const patchLog = useRef([]);
  const readsInFlight = useRef(0);

  // Funzione per recuperare i dati completi dell'utente
  const fetchUserData = useCallback(async () => {
    setLoading(true);
    // Da qui in poi le modifiche si ricordano; quelle già fatte sono dentro la risposta che il server darà
    if (readsInFlight.current === 0) patchLog.current = [];
    readsInFlight.current += 1;
    const logStart = patchLog.current.length;
    try {
      const response = await fetch(`${API_BASE_URL}api/user/read.php`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('account.load_error'));
      }

      const userDetails = await response.json();

      setAccount(Object.assign({ ...userDetails, is_admin: userDetails.is_admin === true }, ...patchLog.current.slice(logStart)));

      if (userDetails.created_at) {
        setJoinDate(new Date(userDetails.created_at));
      } else {
        setJoinDate(new Date());
      }
    } catch (error) {
      console.error('Errore nel recupero dei dati utente:', error);
      notifyRef.current(t('account.load_error'), 'error');
    } finally {
      readsInFlight.current -= 1;
      if (readsInFlight.current === 0) patchLog.current = [];
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        setAccount((prev) => (prev ? { ...prev, tier: details.tier, tier_last_day: details.tier_last_day, signup_code: details.signup_code } : prev));
      })
      .catch((error) => console.error('Errore nel recupero del livello:', error));
  }, [emailState, user]);

  const patchAccount = useCallback((patch) => {
    if (readsInFlight.current > 0) patchLog.current.push(patch);
    setAccount((prev) => ({ ...prev, ...patch }));
  }, []);

  return { account, joinDate, loading, patchAccount };
}

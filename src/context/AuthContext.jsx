import { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config';
import i18n from '../i18n';
import { currentTimeZone } from '../utils/workoutTime';
import { loginWithNext } from '../utils/safeNext';
import { isAuthPath } from '../i18n/paths';

// Crea il contesto di autenticazione
const AuthContext = createContext(null);

// Login dopo una sessione scaduta: poi si torna alla pagina in cui si era
// (non a login o registrazione, da cui il login riporterebbe al login)
const loginAfterExpiry = () => (isAuthPath(window.location.pathname) ? '/login' : loginWithNext(window.location));

// Stato della conferma dell'email, da user/read.php. Un server senza i campi nuovi vale «confermata».
const emailStateFrom = (data) => ({
  verified: data.email_verified !== false,
  email: data.email ?? null,
  pendingEmail: data.pending_email ?? null,
  deadline: data.email_verification?.deadline ?? null,
  blocked: data.email_verification?.blocked === true,
  daysLeft: data.email_verification?.days_left ?? null,
});

// Provider che avvolgerà l'applicazione
export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // null finché non è stato letto
  const [emailState, setEmailState] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const refreshing = useRef(null);

  // Rilegge lo stato della conferma. Non fa mai uscire l'utente: se la lettura non riesce, resta lo stato di prima.
  const refreshEmailState = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const run = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}api/user/read.php`, { method: 'GET', credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (data.success) setEmailState(emailStateFrom(data));
      } catch (error) {
        console.error('Errore lettura stato email:', error);
      } finally {
        refreshing.current = null;
      }
    })();
    refreshing.current = run;
    return run;
  }, []);

  // Il promemoria all'apertura dell'app si valuta una volta sola per apertura (per caricamento della pagina)
  const reminderClaimed = useRef(false);
  const claimEmailReminder = useCallback(() => {
    if (reminderClaimed.current) return false;
    reminderClaimed.current = true;
    return true;
  }, []);

  // Messaggio del server alla conferma con un codice di registrazione («Plus attivo fino al…»): chi conferma lo
  // lascia qui, l'avviso di esito lo ritira quando lo stato passa a «confermata» (una volta sola)
  const emailOutcome = useRef('');
  const reportEmailOutcome = useCallback((message) => { emailOutcome.current = message || ''; }, []);
  const takeEmailOutcome = useCallback(() => {
    const message = emailOutcome.current;
    emailOutcome.current = '';
    return message;
  }, []);

  const openEmailDialog = useCallback(() => setEmailDialogOpen(true), []);
  const closeEmailDialog = useCallback(() => setEmailDialogOpen(false), []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!loggedIn) {
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}api/user/read.php`, {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Sessione non valida');
        }

        const userData = await response.json();
        if (userData.success) {
          setUser(userData);
          setEmailState(emailStateFrom(userData));
          setIsLoggedIn(true);
        } else {
          throw new Error('Validazione fallita');
        }
      } catch (error) {
        console.error('Errore verifica sessione:', error);
        endSession(loginAfterExpiry());
      } finally {
        setLoading(false);
      }
    };
    verifySession();
  }, []);

  // Funzione di login
  const login = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
    setUser(userData);
    // Il login risponde con id, username e lingua: lo stato della conferma si legge subito
    refreshEmailState();
  };

  // Chiude la sessione e porta al login
  const endSession = async (loginUrl) => {
    try {
      // Chiamata al backend per distruggere la sessione
      await fetch(`${API_BASE_URL}api/user/logout.php`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Errore durante il logout dal server:', error);
    } finally {
      // In ogni caso, puliamo lo stato locale
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      setIsLoggedIn(false);
      setUser(null);
      setEmailState(null);
      setEmailDialogOpen(false);
      // Reindirizzamento alla pagina di login
      window.location.href = loginUrl;
    }
  };

  // Logout scelto dall'utente
  const logout = () => endSession('/login');

  // Intercetta le chiamate fetch per gestire sessioni scadute
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      // fetch accetta anche URL e Request: l'indirizzo si legge in tutti i casi
      const requestUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? String(args[0]));
      // Lingua dell'interfaccia per i messaggi del server
      const target = new URL(requestUrl, window.location.origin);
      const isOurApi = target.origin === window.location.origin && target.pathname.startsWith(API_BASE_URL);
      if (isOurApi) {
        const [input, init] = args;
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has('X-Locale')) headers.set('X-Locale', i18n.language);
        // Fuso del dispositivo: "oggi" e "questa settimana" si contano dove si trova l'utente
        const timeZone = currentTimeZone();
        if (timeZone && !headers.has('X-Timezone')) headers.set('X-Timezone', timeZone);
        // Un Request si ricostruisce (metodo e corpo si ereditano), non si può modificare
        args = input instanceof Request ? [new Request(input, { ...init, headers })] : [input, { ...init, headers }];
      }
      const response = await originalFetch(...args);
      // Se 401 Unauthorized e non è una chiamata di login o verifica sessione
      if (response.status === 401 && 
          localStorage.getItem('isLoggedIn') === 'true' && 
          !requestUrl.includes('login.php') && 
          !requestUrl.includes('api/user/read.php')) {
        endSession(loginAfterExpiry());
      }
      // Scadenza dei 7 giorni passata a pagina aperta: 403 (mai 401), si rilegge lo stato e il layout mostra
      // la schermata di conferma. Non è una sessione scaduta: nessuna uscita.
      if (response.status === 403 &&
          isOurApi &&
          localStorage.getItem('isLoggedIn') === 'true' &&
          !requestUrl.includes('api/user/read.php')) {
        response.clone().json().then((body) => {
          if (body?.code === 'email_unverified') refreshEmailState();
        }).catch(() => {});
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [refreshEmailState]);

  // Aggiorna campi dell'utente già salvati sul server (es. la lingua)
  const updateUser = (patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  // Valore fornito dal context
  const authContextValue = {
    isLoggedIn,
    user,
    login,
    logout,
    updateUser,
    loading,
    emailState,
    refreshEmailState,
    emailDialogOpen,
    openEmailDialog,
    closeEmailDialog,
    claimEmailReminder,
    reportEmailOutcome,
    takeEmailOutcome
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizzato per utilizzare il contesto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato all\'interno di un AuthProvider');
  }
  return context;
};



export default AuthContext;
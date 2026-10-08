import { createContext, useState, useEffect, useContext } from 'react';
import { API_BASE_URL } from '../config';
import i18n from '../i18n';

// Crea il contesto di autenticazione
const AuthContext = createContext(null);

// Provider che avvolgerà l'applicazione
export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
          setIsLoggedIn(true);
        } else {
          throw new Error('Validazione fallita');
        }
      } catch (error) {
        console.error('Errore verifica sessione:', error);
        logout();
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
  };

  // Funzione di logout
  const logout = async () => {
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
      // Reindirizzamento alla pagina di login
      window.location.href = '/login';
    }
  };

  // Intercetta le chiamate fetch per gestire sessioni scadute
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      // Lingua dell'interfaccia per i messaggi del server
      if (typeof args[0] === 'string' && args[0].startsWith(API_BASE_URL)) {
        const headers = new Headers(args[1]?.headers);
        if (!headers.has('X-Locale')) headers.set('X-Locale', i18n.language);
        args[1] = { ...args[1], headers };
      }
      const response = await originalFetch(...args);
      // Se 401 Unauthorized e non è una chiamata di login o verifica sessione
      if (response.status === 401 && 
          localStorage.getItem('isLoggedIn') === 'true' && 
          !args[0].includes('login.php') && 
          !args[0].includes('api/user/read.php')) {
        logout();
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

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
    loading
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
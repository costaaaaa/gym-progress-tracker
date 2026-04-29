import React, { createContext, useState, useEffect, useContext } from 'react';
import { API_BASE_URL } from '../config';

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
  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    setUser(null);
    // Utilizzo il path assoluto per il reindirizzamento
    window.location.href = '/gym-progress-tracker-v2/login';
  };

  // Intercetta le chiamate fetch per gestire sessioni scadute
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
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

  // Valore fornito dal context
  const authContextValue = {
    isLoggedIn,
    user,
    login,
    logout,
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
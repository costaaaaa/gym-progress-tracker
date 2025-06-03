import React, { createContext, useState, useEffect, useContext } from 'react';

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

        const response = await fetch(`${process.env.PUBLIC_URL}/backend/api/user/validate-session.php`, {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Sessione non valida');
        }

        const userData = JSON.parse(localStorage.getItem('user'));
        setUser(userData);
        setIsLoggedIn(true);
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
    // Utilizzo il basename corretto per il reindirizzamento
    window.location.href = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/login` : '/gym-progress-tracker-v2/login';
  };

  // Intercetta le chiamate fetch per gestire sessioni scadute
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && 
          localStorage.getItem('isLoggedIn') === 'true' && 
          !response.url.includes('validate-session.php')) {
        logout();
        // Utilizzo il basename corretto per il reindirizzamento
        window.location.href = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/login` : '/gym-progress-tracker-v2/login';
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
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Per le pagine fuori dal layout (Focus): con l'app bloccata dalla conferma dell'email si va alla home,
// dove il layout mostra la schermata di conferma. Le chiamate di Focus risponderebbero tutte 403.
const EmailBlockGuard = ({ children }) => {
  const { isLoggedIn, emailState } = useAuth();
  if (isLoggedIn && emailState?.blocked === true) return <Navigate to="/" replace />;
  return children;
};

export default EmailBlockGuard;

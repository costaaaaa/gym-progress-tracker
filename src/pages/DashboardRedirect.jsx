import { Navigate, useLocation } from 'react-router-dom';

// /dashboard era l'indirizzo dei Progressi: porta a /progressi con la stessa query (?tab=...), l'hash e lo stato di
// navigazione, perché i segnalibri e i collegamenti di prima aprano la stessa tab.
const DashboardRedirect = () => {
  const { search, hash, state } = useLocation();
  return <Navigate to={{ pathname: '/progressi', search, hash }} replace state={state} />;
};

export default DashboardRedirect;

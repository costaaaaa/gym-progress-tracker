import { Navigate, useLocation } from 'react-router-dom';

// Gli indirizzi di prima, quando Schede e Storico erano due schede della stessa pagina (/workouts?tab=...) o due pagine
// con altro nome (/workout-plans, /workout-history), portano alle pagine nuove. Resto della query, hash e stato di
// navigazione (es. refreshHistory) passano con l'utente; `tab` no. Senza `to` decide ?tab=: history va allo Storico,
// tutto il resto alle Schede.
const LegacyWorkoutsRedirect = ({ to = null }) => {
  const { search, hash, state } = useLocation();
  const params = new URLSearchParams(search);
  const destination = to ?? (params.get('tab') === 'history' ? '/storico' : '/schede');
  params.delete('tab');
  const rest = params.toString();
  return <Navigate to={{ pathname: destination, search: rest ? `?${rest}` : '', hash }} replace state={state} />;
};

export default LegacyWorkoutsRedirect;

import { Navigate, useLocation } from 'react-router-dom';

// L'indirizzo di prima, quando Schede e Storico erano due schede della stessa pagina: ?tab=history porta allo Storico,
// tutto il resto alle Schede. Lo stato di navigazione (es. refreshHistory) passa con l'utente.
const Workouts = () => {
  const { search, state } = useLocation();
  const history = new URLSearchParams(search).get('tab') === 'history';
  return <Navigate to={history ? '/storico' : '/schede'} replace state={state} />;
};

export default Workouts;

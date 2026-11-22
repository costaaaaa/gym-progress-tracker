import { Navigate, useLocation } from 'react-router-dom';

// /profilo era una pagina con due schede: con ?tab=settings l'Account, in ogni altro caso i Livelli e traguardi. Ora
// sono due pagine (/account e /livelli): i segnalibri, le email già spedite e il `next` del login restano validi.
// L'ancora passa con l'utente (/profilo?tab=settings#groups-shown arriva a /account#groups-shown).
const ProfileRedirect = () => {
  const { search, hash } = useLocation();
  const settings = new URLSearchParams(search).get('tab') === 'settings';
  return <Navigate to={{ pathname: settings ? '/account' : '/livelli', hash }} replace />;
};

export default ProfileRedirect;

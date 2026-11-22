import { Navigate, useLocation } from 'react-router-dom';

// /profilo era una pagina con due schede: con ?tab=settings l'Account, in ogni altro caso i Livelli e traguardi. Ora
// sono due pagine (/account e /livelli): i segnalibri, le email già spedite e il `next` del login restano validi.
// Le ancore della vecchia pagina dell'Account (#groups-shown, #groups-list) stanno ora in «Dati e privacy»:
// /profilo?tab=settings#groups-shown arriva a /account/dati#groups-shown, senza ancora all'elenco dell'Account.
const ProfileRedirect = () => {
  const { search, hash } = useLocation();
  const settings = new URLSearchParams(search).get('tab') === 'settings';
  if (!settings) return <Navigate to={{ pathname: '/livelli', hash }} replace />;
  return <Navigate to={{ pathname: hash ? '/account/dati' : '/account', hash }} replace />;
};

export default ProfileRedirect;

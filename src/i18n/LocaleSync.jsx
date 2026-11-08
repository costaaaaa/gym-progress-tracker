import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import i18n, { normalizeLocale, getLanguageChoice, setLanguageChoice } from './index';
import { isAuthPath, isEnPath, isPublicPath, stripLangPrefix, withLangPrefix } from './paths';
import { safeNext } from '../utils/safeNext';

// Da loggati decide sempre l'account, e le pagine /en/ portano a quelle senza prefisso;
// login e registrazione portano alla pagina del ?next=, la stessa a cui va il login appena fatto.
// Da sloggati decide l'URL; chi ha scelto l'inglese su questo dispositivo, se arriva su una
// pagina pubblica italiana (logout, sessione scaduta, link a /login), passa alla versione /en/.
// Google non ha memoria tra le visite: per lui / resta italiano e /en/ inglese.
const LocaleSync = () => {
  const { user, loading } = useAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const onEn = isEnPath(pathname);

  useEffect(() => {
    let target;
    if (user) {
      target = normalizeLocale(user.locale) || 'it';
      setLanguageChoice(target);
      if (onEn) {
        const to = isAuthPath(pathname) ? safeNext(search) : stripLangPrefix(pathname) + search;
        navigate(to, { replace: true });
      }
    } else if (onEn) {
      target = 'en';
      setLanguageChoice('en');
    } else if (!loading) {
      if (getLanguageChoice() === 'en' && isPublicPath(pathname)) {
        navigate(withLangPrefix(pathname, 'en') + search, { replace: true });
        return;
      }
      target = 'it';
    }
    if (target && target !== i18n.language) i18n.changeLanguage(target);
  }, [onEn, user, loading, pathname, search, navigate]);

  return null;
};

export default LocaleSync;

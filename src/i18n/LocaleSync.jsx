import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import i18n, { normalizeLocale } from './index';
import { isEnPath } from './paths';

// Sulle pagine /en/ decide l'URL, altrove la lingua dell'account; senza account, italiano.
const LocaleSync = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const onEn = isEnPath(pathname);

  useEffect(() => {
    let target;
    if (onEn) target = 'en';
    else if (user) target = normalizeLocale(user.locale) || 'it';
    else if (!loading) target = 'it';
    if (target && target !== i18n.language) i18n.changeLanguage(target);
  }, [onEn, user, loading]);

  return null;
};

export default LocaleSync;

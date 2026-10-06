import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import i18n from './index';

const LocaleSync = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.locale) i18n.changeLanguage(user.locale);
  }, [user?.locale]);
  return null;
};

export default LocaleSync;

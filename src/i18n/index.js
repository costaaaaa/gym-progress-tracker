import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './it.json';
import en from './en.json';

export const SUPPORTED_LOCALES = ['it', 'en'];
const STORAGE_KEY = 'lx_locale';

const normalize = (value) => {
  const code = String(value || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(code) ? code : null;
};

i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: normalize(localStorage.getItem(STORAGE_KEY)) || normalize(navigator.language) || 'it',
  fallbackLng: 'it',
  keySeparator: false,
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

export default i18n;

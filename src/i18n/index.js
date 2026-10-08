import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './it.json';
import en from './en.json';
import { isEnPath } from './paths';

export const SUPPORTED_LOCALES = ['it', 'en'];
const STORAGE_KEY = 'lx_locale';

export const normalizeLocale = (value) => {
  const code = String(value || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(code) ? code : null;
};

// Prima di read.php l'utente loggato vede l'ultima lingua usata, senza lampo d'italiano.
const initialLocale = () => {
  if (isEnPath(window.location.pathname)) return 'en';
  if (localStorage.getItem('isLoggedIn') === 'true') return normalizeLocale(localStorage.getItem(STORAGE_KEY)) || 'it';
  return 'it';
};

// Prima lingua supportata tra quelle del browser, in ordine di preferenza.
export const browserLocale = () =>
  (navigator.languages || [navigator.language]).map(normalizeLocale).find(Boolean) || null;

const applyLanguage = (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
};

i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: 'it',
  keySeparator: false,
  interpolation: { escapeValue: false },
});

applyLanguage(i18n.language);
i18n.on('languageChanged', applyLanguage);

export default i18n;

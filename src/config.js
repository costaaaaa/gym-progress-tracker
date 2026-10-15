// Configuration file for the application

// Base URL for API requests: sempre relativa, così segue il protocollo e l'host della pagina.
// In sviluppo la gira al PHP locale il proxy di Vite (vite.config.js, BACKEND_URL).
export const API_BASE_URL = '/backend/';

// Other configuration settings
export const APP_NAME = 'LiftIndex';
export const APP_VERSION = '2.0.0';
// Pagine dell'app negli store, per il link dal sito (components/HealthAppHint.jsx). Vuoto finché
// l'app non è pubblicata in quello store: il link non compare.
// Android, quando è pubblicata: https://play.google.com/store/apps/details?id=app.liftindex.mobile
export const STORE_LINKS = {
  ios: '',
  android: '',
};

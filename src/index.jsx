import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import { ThemeModeProvider } from './context/ThemeModeContext';
import CssBaseline from '@mui/material/CssBaseline';
import { initAnalytics } from './utils/analytics';

initAnalytics();

// Dopo un deploy i chunk della versione aperta non esistono più (nomi con
// hash): invece dell'errore ricarica una volta per prendere la versione nuova.
// Se ha già ricaricato da poco il file manca davvero: lascia passare l'errore.
const RELOAD_KEY = 'chunkReloadAt';
window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY));
  if (Date.now() - last < 10000) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeModeProvider>
      <CssBaseline />
      <App />
    </ThemeModeProvider>
  </React.StrictMode>
);

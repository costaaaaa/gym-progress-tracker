// Tema delle pagine statiche (informativa, termini, 404): la stessa scelta dell'app e del blog
// (chiave themeMode in localStorage, stessa origine); se non c'e', la preferenza del sistema.
// Caricato in <head> senza defer, cosi' la pagina non compare prima nel tema sbagliato; inline non si
// puo' (CSP script-src 'self'). Senza JS la pagina resta chiara.
(function () {
  'use strict';

  var mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    var saved = localStorage.getItem('themeMode');
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch (e) { /* storage bloccato: vale il sistema */ }
  document.documentElement.setAttribute('data-theme', mode);
})();

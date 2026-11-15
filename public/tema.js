// Tema delle pagine statiche (informativa, termini, 404): la stessa scelta dell'app e del blog
// (chiave themeMode in localStorage, stessa origine), chiaro se non c'e', senza guardare il sistema.
// Caricato in <head> senza defer, cosi' la pagina non compare prima nel tema sbagliato; inline non si
// puo' (CSP script-src 'self'). Senza JS la pagina resta chiara.
(function () {
  'use strict';

  var mode = 'light';
  try {
    if (localStorage.getItem('themeMode') === 'dark') mode = 'dark';
  } catch (e) { /* storage bloccato: resta chiaro */ }
  document.documentElement.setAttribute('data-theme', mode);
})();

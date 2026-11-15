// Tema chiaro/scuro del blog: la stessa scelta dell'app (chiave themeMode in
// localStorage, stessa origine); se non c'e', la preferenza del sistema, come nell'app. Caricato in
// <head> senza defer, cosi' la pagina non compare prima nel tema sbagliato;
// inline non si puo' (CSP script-src 'self'). Senza JS il blog resta chiaro.
(function () {
  'use strict';

  var root = document.documentElement;
  var mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    var saved = localStorage.getItem('themeMode');
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch (e) { /* storage bloccato: vale il sistema */ }
  root.setAttribute('data-theme', mode);

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('[data-theme-toggle]');
    if (!button) return;

    function syncLabel() {
      var label = root.lang === 'en'
        ? (mode === 'light' ? 'Dark mode' : 'Light mode')
        : (mode === 'light' ? 'Modalità scura' : 'Modalità chiara');
      button.setAttribute('aria-label', label);
      button.title = label;
    }

    syncLabel();
    button.hidden = false;
    button.addEventListener('click', function () {
      mode = mode === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', mode);
      try {
        localStorage.setItem('themeMode', mode);
      } catch (e) { /* vale solo per questa pagina */ }
      syncLabel();
    });
  });
})();

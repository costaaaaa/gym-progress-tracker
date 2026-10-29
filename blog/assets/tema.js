// Tema chiaro/scuro del blog: la stessa scelta dell'app (chiave themeMode in
// localStorage, stessa origine), chiaro se non c'e', come nell'app. Caricato in
// <head> senza defer, cosi' la pagina non compare prima nel tema sbagliato;
// inline non si puo' (CSP script-src 'self'). Senza JS il blog resta chiaro.
(function () {
  'use strict';

  var root = document.documentElement;
  var mode = 'light';
  try {
    if (localStorage.getItem('themeMode') === 'dark') mode = 'dark';
  } catch (e) { /* storage bloccato: resta chiaro */ }
  root.setAttribute('data-theme', mode);

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('[data-theme-toggle]');
    if (!button) return;

    function syncLabel() {
      var label = mode === 'light' ? 'Modalità scura' : 'Modalità chiara';
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

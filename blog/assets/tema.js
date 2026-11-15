// Bottone del tema del blog. Il tema (scelta salvata nell'app, altrimenti il sistema) lo decide /tema.js,
// lo stesso delle pagine statiche e dell'app, caricato prima in <head>: qui si legge data-theme da <html> e
// si salva la scelta (chiave themeMode in localStorage, stessa origine). Senza JS il blog resta chiaro.
(function () {
  'use strict';

  var root = document.documentElement;
  var mode = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
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

// Calcolatore 1RM: aggiorna risultato e tabella mentre si digita. La pagina
// funziona anche senza questo script (form in GET calcolato lato server);
// formula e arrotondamenti sono gli stessi di calcolatore-1rm/index.php.
(function () {
  'use strict';

  var form = document.querySelector('[data-calc-form]');
  if (!form) return;

  var weightInput = form.elements.peso;
  var repsInput = form.elements.ripetizioni;
  var oneRmEl = document.querySelector('[data-calc-one-rm]');
  var warningEl = document.querySelector('[data-calc-warning]');
  var rows = document.querySelectorAll('[data-calc-percent]');

  function formatKg(kg) {
    return String(parseFloat(kg.toFixed(1))).replace('.', ',');
  }

  function update() {
    var weight = parseFloat(String(weightInput.value).replace(',', '.'));
    var reps = parseInt(repsInput.value, 10);
    if (!(weight > 0) || !(reps > 0) || weight > 500 || reps > 20) return;

    var oneRm = parseFloat((weight * (1 + reps / 30)).toFixed(1));
    oneRmEl.textContent = formatKg(oneRm);
    warningEl.hidden = reps <= 10;

    for (var i = 0; i < rows.length; i++) {
      var percent = parseInt(rows[i].getAttribute('data-calc-percent'), 10);
      var load = Math.round((oneRm * percent) / 100 / 2.5) * 2.5;
      rows[i].querySelector('[data-calc-load]').textContent = formatKg(load);
    }
  }

  weightInput.addEventListener('input', update);
  repsInput.addEventListener('input', update);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    update();
  });
})();

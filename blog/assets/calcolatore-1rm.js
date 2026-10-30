// Calcolatore 1RM: aggiorna risultato e tabella mentre si digita. La pagina
// funziona anche senza questo script (form in GET calcolato lato server);
// formula, arrotondamenti e limiti sono gli stessi di lib/calculator.php.
// Serve la pagina italiana (solo kg, virgola decimale) e quella inglese
// (kg o lb, punto decimale): le differenze le dicono gli attributi data-calc-*.
(function () {
  'use strict';

  var UNITS = { kg: { max: 500, step: 2.5 }, lb: { max: 1100, step: 5 } };

  var form = document.querySelector('[data-calc-form]');
  if (!form) return;

  var decimal = form.getAttribute('data-calc-decimal') || '.';
  var weightInput = form.querySelector('[data-calc-weight]');
  var repsInput = form.querySelector('[data-calc-reps]');
  var unitSelect = form.querySelector('[data-calc-unit]');
  var unitLabels = document.querySelectorAll('[data-calc-unit-label]');
  var oneRmEl = document.querySelector('[data-calc-one-rm]');
  var warningEl = document.querySelector('[data-calc-warning]');
  var rows = document.querySelectorAll('[data-calc-percent]');

  function format(value) {
    return String(parseFloat(value.toFixed(1))).replace('.', decimal);
  }

  function update() {
    var unit = unitSelect ? unitSelect.value : 'kg';
    var limits = UNITS[unit];
    weightInput.max = limits.max;

    var weight = parseFloat(String(weightInput.value).replace(',', '.'));
    var reps = parseInt(repsInput.value, 10);
    // Con un valore non valido resta il risultato precedente, unita' compresa.
    if (!(weight > 0) || !(reps > 0) || weight > limits.max || reps > 20) return;

    for (var u = 0; u < unitLabels.length; u++) unitLabels[u].textContent = unit;
    var oneRm = parseFloat((weight * (1 + reps / 30)).toFixed(1));
    oneRmEl.textContent = format(oneRm);
    warningEl.hidden = reps <= 10;

    for (var i = 0; i < rows.length; i++) {
      var percent = parseInt(rows[i].getAttribute('data-calc-percent'), 10);
      var load = Math.round((oneRm * percent) / 100 / limits.step) * limits.step;
      rows[i].querySelector('[data-calc-load]').textContent = format(load);
    }
  }

  weightInput.addEventListener('input', update);
  repsInput.addEventListener('input', update);
  if (unitSelect) unitSelect.addEventListener('change', update);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    update();
  });
})();

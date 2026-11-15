// Calcolatore 1RM: aggiorna risultato e tabella mentre si digita. La pagina
// funziona anche senza questo script (form in GET calcolato lato server);
// formula, arrotondamenti e limiti sono gli stessi di lib/calculator.php.
// Serve la pagina italiana (solo kg, virgola decimale) e quella inglese
// (kg o lb, punto decimale): le differenze le dicono gli attributi data-calc-*.
// Un valore non valido ha il suo messaggio sotto il campo (testi in data-calc-msg-weight e
// data-calc-msg-reps, con {max} e {unit}); con lo script attivo la validazione del browser e'
// spenta, cosi' i messaggi sono questi.
(function () {
  'use strict';

  var UNITS = { kg: { max: 500, step: 2.5 }, lb: { max: 1100, step: 5 } };
  var MAX_REPS = 20;

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
  var errorEls = {
    weight: form.querySelector('[data-calc-error="weight"]'),
    reps: form.querySelector('[data-calc-error="reps"]')
  };
  form.noValidate = true;

  function format(value) {
    return String(parseFloat(value.toFixed(1))).replace('.', decimal);
  }

  // Mostra o toglie il messaggio di un campo. Il testo si riscrive solo se cambia: lo stesso
  // errore a ogni tasto non va riannunciato.
  function setError(name, input, message) {
    var el = errorEls[name];
    if (!el) return;
    if (message) {
      if (el.textContent !== message) el.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  }

  function message(name, limits, unit) {
    return (form.getAttribute('data-calc-msg-' + name) || '')
      .replace('{max}', name === 'weight' ? limits.max : MAX_REPS)
      .replace('{unit}', unit);
  }

  // strict: invio o uscita dal campo, dove anche un campo vuoto e' un errore; mentre si digita
  // un campo vuoto (o cancellato per riscriverlo) non si rimprovera.
  function update(strict) {
    var unit = unitSelect ? unitSelect.value : 'kg';
    var limits = UNITS[unit];
    weightInput.max = limits.max;

    var weight = parseFloat(String(weightInput.value).replace(',', '.'));
    var reps = parseInt(repsInput.value, 10);
    var weightBad = !(weight > 0) || weight > limits.max;
    var repsBad = !(reps > 0) || reps > MAX_REPS;
    var weightShown = strict || weightInput.value !== '' || (weightInput.validity && weightInput.validity.badInput);
    var repsShown = strict || repsInput.value !== '' || (repsInput.validity && repsInput.validity.badInput);
    setError('weight', weightInput, weightBad && weightShown ? message('weight', limits, unit) : '');
    setError('reps', repsInput, repsBad && repsShown ? message('reps', limits, unit) : '');
    // Con un valore non valido resta il risultato precedente, unita' compresa.
    if (weightBad || repsBad) return;

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

  function onInput() { update(false); }
  function onLeave() { update(true); }
  weightInput.addEventListener('input', onInput);
  repsInput.addEventListener('input', onInput);
  weightInput.addEventListener('change', onLeave);
  repsInput.addEventListener('change', onLeave);
  if (unitSelect) unitSelect.addEventListener('change', onInput);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    update(true);
  });
})();

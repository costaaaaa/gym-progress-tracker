import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from '@mui/material';
import { errorMessage } from '../../api/exercises';

const FIELD_OF_ERROR = {
  code_taken: 'code',
  invalid_code: 'code',
  invalid_tier: 'tier',
  invalid_duration: 'duration',
  confirm_forever_required: 'duration',
  invalid_max_uses: 'maxUses',
  max_uses_below_taken: 'maxUses',
  invalid_date: 'lastDay',
  invalid_assignee: 'assignee',
};

const textOf = (value) => (value === null || value === undefined ? '' : String(value));

// Valori di partenza del modulo: da un codice dell'elenco, o vuoti per un codice nuovo
const startValues = (code) => ({
  code: code?.code ?? '',
  tier: code?.tier ?? 'plus',
  duration: textOf(code?.duration_days),
  maxUses: textOf(code?.max_uses),
  lastDay: code?.last_day ?? '',
  assignee: code?.assignee ?? '',
  enabled: code ? code.enabled : true,
});

// Cosa mandare al server. Creazione: tutti i campi compilati. Modifica: solo quelli cambiati, e livello, durata e
// testo solo se il codice non ha usi. Durata vuota = per sempre: richiede confirm_forever (`forever` ne dice la necessità).
const buildPayload = (values, initial, locked) => {
  const fields = {};
  const duration = values.duration.trim();
  const durationFields = () => (duration === '' ? { duration_days: null, confirm_forever: true } : { duration_days: Number(duration) });
  const assignee = values.assignee.trim();
  if (!initial) {
    if (values.code.trim()) fields.code = values.code.trim();
    fields.tier = values.tier;
    Object.assign(fields, durationFields());
    fields.max_uses = Number(values.maxUses);
    if (values.lastDay) fields.last_day = values.lastDay;
    if (assignee) fields.assignee = assignee;
    return { fields, forever: duration === '' };
  }
  if (Number(values.maxUses) !== initial.max_uses) fields.max_uses = Number(values.maxUses);
  if (values.lastDay !== (initial.last_day ?? '')) fields.last_day = values.lastDay;
  if (assignee !== (initial.assignee ?? '')) fields.assignee = assignee;
  if (values.enabled !== initial.enabled) fields.enabled = values.enabled;
  let forever = false;
  if (!locked) {
    if (values.tier !== initial.tier) fields.tier = values.tier;
    if (duration !== textOf(initial.duration_days)) {
      Object.assign(fields, durationFields());
      forever = duration === '';
    }
    if (values.code.trim() !== initial.code) fields.code = values.code.trim();
  }
  return { fields, forever };
};

// Modulo di un codice di registrazione, per creare (`initial` assente) o modificare. `locked`: il codice ha già usi,
// quindi livello, durata e testo non si cambiano. `onSubmit(fields)` ritorna { ok, data } come le funzioni di api/signupCodes.js.
const SignupCodeForm = ({ initial = null, locked = false, submitLabel, onSubmit, onCancel, onDone }) => {
  const [values, setValues] = useState(() => startValues(initial));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // campi in attesa della conferma «per sempre»

  const set = (field) => (e) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  const send = async (fields) => {
    setSaving(true);
    setFormError('');
    const res = await onSubmit(fields);
    setSaving(false);
    if (res.ok) {
      onDone(res.data);
      return;
    }
    const field = FIELD_OF_ERROR[res.data?.code];
    if (field) setErrors({ [field]: errorMessage(res) });
    else setFormError(errorMessage(res, 'Operazione non riuscita.'));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!/^\d+$/.test(values.maxUses.trim()) || Number(values.maxUses) < 1) {
      setErrors({ maxUses: 'Inserisci i posti (almeno 1).' });
      return;
    }
    setErrors({});
    const { fields, forever } = buildPayload(values, initial, locked);
    if (initial && Object.keys(fields).length === 0) {
      setFormError('');
      onDone(null);
      return;
    }
    if (forever) {
      setConfirm(fields);
      return;
    }
    await send(fields);
  };

  const confirmForever = async () => {
    const fields = confirm;
    setConfirm(null);
    await send(fields);
  };

  const field = (name, props) => ({
    value: values[name],
    onChange: set(name),
    error: Boolean(errors[name]),
    helperText: errors[name] || props.help || undefined,
    fullWidth: true,
    margin: 'dense',
    InputLabelProps: { shrink: true },
    ...props.extra,
  });

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <TextField label="Codice" {...field('code', { help: initial ? '' : 'Vuoto: lo genera il sistema', extra: { disabled: locked, autoComplete: 'off', inputProps: { autoCapitalize: 'none', spellCheck: false } } })} />
      <TextField
        select
        label="Livello"
        SelectProps={{ native: true }}
        {...field('tier', { extra: { disabled: locked } })}
      >
        <option value="plus">Plus</option>
        <option value="pro">Pro</option>
      </TextField>
      <TextField
        label="Durata in giorni"
        type="number"
        {...field('duration', { help: 'Dalla conferma dell\'email. Vuota: il livello dura per sempre.', extra: { disabled: locked, inputProps: { min: 1, max: 3650 } } })}
      />
      <TextField label="Posti" type="number" {...field('maxUses', { extra: { inputProps: { min: 1 } } })} />
      <TextField label="Ultimo giorno d'uso" type="date" {...field('lastDay', { help: 'Vuoto: il codice non scade.' })} />
      <TextField label="Assegnatario" {...field('assignee', { help: 'Testo libero, per ricordarti a chi l\'hai dato.' })} />
      {locked && (
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 1 }}>Dopo il primo uso livello, durata e testo non si cambiano.</Typography>
      )}
      {initial && (
        <FormControlLabel
          sx={{ display: 'flex', mt: 1 }}
          control={<Checkbox checked={values.enabled} onChange={(e) => setValues((prev) => ({ ...prev, enabled: e.target.checked }))} />}
          label="Acceso"
        />
      )}

      {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 2 }}>
        <Button type="submit" variant="contained" disabled={saving} sx={{ minHeight: 44, fontSize: 16 }}>{submitLabel}</Button>
        {onCancel && <Button onClick={onCancel} disabled={saving} sx={{ minHeight: 44, fontSize: 16 }}>Annulla</Button>}
      </Box>

      {confirm && (
        <Dialog open onClose={() => setConfirm(null)} aria-labelledby="signup-forever-title">
          <DialogTitle id="signup-forever-title">Questo codice dà il livello per sempre</DialogTitle>
          <DialogContent>
            <Typography>Senza una durata chi si registra con il codice resta Plus o Pro senza scadenza. Va bene solo per amici stretti e tester.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirm(null)} sx={{ minHeight: 44, fontSize: 16 }}>Annulla</Button>
            <Button onClick={confirmForever} variant="contained" sx={{ minHeight: 44, fontSize: 16 }}>Sì, per sempre</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default SignupCodeForm;

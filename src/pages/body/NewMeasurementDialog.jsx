import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { format, isValid } from 'date-fns';
import LabeledDatePicker from '../../components/LabeledDatePicker';
import DateLocalization from '../../i18n/DateLocalization';
import { formatMeasureText } from '../../i18n/format';
import { BODY_LB_DIVISIONS, fieldTextToKgText, maxWeightInUnit, weightUnitLabel } from '../../utils/weightUnit';
import { fieldTextToCmText, lengthUnitLabel, maxLengthInUnit } from '../../utils/lengthUnit';
import { BODY_LIMITS, isValueOutOfRange } from '../../utils/bodyStatsRules';
import useFocusField from '../../hooks/useFocusField';
import { LENGTH_FIELDS } from './series';

// Campi del modulo nell'ordine in cui compaiono (il primo con un errore riceve il focus)
const FORM_FIELDS = ['date', ...Object.keys(BODY_LIMITS)];

const numberFieldSx = {
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
  '& input[type=number]': { MozAppearance: 'textfield' },
};

const emptyForm = () => ({
  date: new Date(),
  weight: '',
  body_fat_percentage: '',
  muscle_mass_percentage: '',
  chest_size: '',
  arm_size: '',
  waist_size: '',
  leg_size: '',
});

// Finestra «Nuova misurazione»: i campi, la validazione e gli errori sotto ogni campo. `save` è quello di useBodyStats;
// `onNotify(message, severity)` porta alla pagina l'esito che non riguarda un campo. Il testo scritto resta se si chiude senza salvare.
const NewMeasurementDialog = ({ open, onClose, save, onNotify, weightUnit }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(emptyForm);
  // Messaggio d'errore sotto ogni campo sbagliato; il focus va sul primo
  const [fieldErrors, setFieldErrors] = useState({});
  const { fieldRef, focusField } = useFocusField();

  // Ogni apertura riparte senza errori (si azzera nello stesso render in cui la finestra si apre)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFieldErrors({});
  }

  // Proprietà comuni dei sette campi numerici del modulo; l'errore passa da error + helperText (aria-describedby)
  const numberField = (name, labelKey) => ({
    label: t(labelKey, { unit: LENGTH_FIELDS.includes(name) ? lengthUnitLabel(weightUnit) : weightUnitLabel(weightUnit) }), name, type: 'number', fullWidth: true, value: formData[name], onChange: handleInputChange, sx: numberFieldSx,
    error: !!fieldErrors[name], helperText: fieldErrors[name], inputRef: fieldRef(name),
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (fieldErrors[name]) setFieldErrors(({ [name]: _removed, ...others }) => others);
  };

  const showFieldErrors = (errors) => {
    setFieldErrors(errors);
    focusField(FORM_FIELDS.find((name) => errors[name]));
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, date });
    if (fieldErrors.date) setFieldErrors(({ date: _removed, ...others }) => others);
  };

  // Il tetto del peso e delle circonferenze si mostra nell'unità dell'utente, gli altri com'è
  const rangeMax = (name, max) => {
    if (name === 'weight') return formatMeasureText(maxWeightInUnit(max, weightUnit, BODY_LB_DIVISIONS));
    return LENGTH_FIELDS.includes(name) ? formatMeasureText(maxLengthInUnit(max, weightUnit)) : max;
  };

  // Il testo di un campo, nell'unità scelta, in kg (peso) o cm (circonferenze) per le regole e il payload; gli altri com'è
  const baseText = (name) => {
    if (name === 'weight') return fieldTextToKgText(formData.weight, weightUnit);
    return LENGTH_FIELDS.includes(name) ? fieldTextToCmText(formData[name], weightUnit) : formData[name];
  };

  const handleSubmit = async () => {
    const errors = {};
    // Data cancellata o incompleta (si digita con il puntatore preciso): arriva null o una data non valida
    if (!isValid(formData.date)) errors.date = t('body.error.date');
    // Peso e circonferenze si scrivono nell'unità dell'utente; le regole e il payload sono in kg e cm
    const base = Object.fromEntries(Object.keys(BODY_LIMITS).map((name) => [name, baseText(name)]));
    Object.entries(BODY_LIMITS).forEach(([name, max]) => {
      const value = base[name];
      if (value === null || isValueOutOfRange(value, max)) errors[name] = t('body.error.range', { max: rangeMax(name, max) });
    });
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }
    const result = await save({
      ...formData,
      date: format(formData.date, 'yyyy-MM-dd'),
      weight: base.weight || null,
      body_fat_percentage: formData.body_fat_percentage || null,
      muscle_mass_percentage: formData.muscle_mass_percentage || null,
      chest_size: base.chest_size || null,
      arm_size: base.arm_size || null,
      waist_size: base.waist_size || null,
      leg_size: base.leg_size || null,
    });
    if (result.ok) {
      onNotify(t('body.saved'), 'success');
      onClose();
      setFormData(emptyForm());
    } else if (result.connection) {
      onNotify(t('body.error.connection'), 'error');
    } else if (BODY_LIMITS[result.field]) {
      // Con "max" il testo è quello del client (uguale a quello prima dell'invio); il messaggio del server resta il ripiego
      showFieldErrors({ [result.field]: Number.isFinite(result.max) ? t('body.error.range', { max: rangeMax(result.field, result.max) }) : result.message });
    } else {
      onNotify(result.message || t('body.error.save'), 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('body.dialog_title')}</DialogTitle>
      <DialogContent dividers>
        <DateLocalization>
          <LabeledDatePicker
            label={t('body.field.date')}
            value={formData.date}
            onChange={handleDateChange}
            // L'errore proprio del selettore (data digitata non valida) resta; il nostro compare solo dopo "Salva"
            slotProps={{ textField: { fullWidth: true, sx: { mb: 3, mt: 1 }, inputRef: fieldRef('date'), ...(fieldErrors.date && { error: true, helperText: fieldErrors.date }) } }}
          />
        </DateLocalization>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField {...numberField('weight', 'body.field.weight')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...numberField('body_fat_percentage', 'body.field.fat')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField {...numberField('muscle_mass_percentage', 'body.field.muscle')} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField {...numberField('chest_size', 'body.field.chest')} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField {...numberField('arm_size', 'body.field.arm')} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField {...numberField('waist_size', 'body.field.waist')} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField {...numberField('leg_size', 'body.field.leg')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewMeasurementDialog;

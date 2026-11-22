import { formatLengthInUnit, lengthUnitLabel } from '../../utils/lengthUnit';
import { formatMeasureText, intlLocale } from '../../i18n/format';

// Misure della card "Composizione corporea" e "Circonferenze": chiave dato, etichetta, unità.
export const BODY_COMPOSITION_SERIES = [
  { key: 'body_fat_percentage', label: 'body.fat', unit: '%' },
  { key: 'muscle_mass_percentage', label: 'body.muscle', unit: '%' },
];
// Circonferenze: i dati sono in cm, si mostrano nell'unità dell'account (cm con kg, pollici con lb)
export const CIRCUMFERENCE_SERIES = [
  { key: 'chest_size', label: 'body.chest', isLength: true },
  { key: 'waist_size', label: 'body.waist', isLength: true },
  { key: 'arm_size', label: 'body.arm', isLength: true },
  { key: 'leg_size', label: 'body.leg', isLength: true },
];
export const LENGTH_FIELDS = CIRCUMFERENCE_SERIES.map((s) => s.key);
export const HISTORY_SERIES = [...BODY_COMPOSITION_SERIES, ...CIRCUMFERENCE_SERIES];

// Valore di una misura con la sua unità: percentuale attaccata al numero, lunghezza con uno spazio e cm o in
export const measureText = (series, value, weightUnit) => (series.isLength
  ? `${formatLengthInUnit(value, weightUnit, intlLocale(), { unit: false })} ${lengthUnitLabel(weightUnit)}`
  : `${formatMeasureText(value)}${series.unit}`);

// Linea dei grafici del corpo (peso e altre misure): neutra, il rosso del marchio non è un dato
export const CHART_LINE_COLOR = 'text.primary';

export const hasValue = (v) => v !== null && v !== undefined && v !== '';

export const lastValueOf = (data, key) => {
  for (let i = data.length - 1; i >= 0; i--) {
    if (hasValue(data[i][key])) return data[i][key];
  }
  return null;
};

// Cuore accanto a un valore arrivato da Apple Salute / Health Connect
// (health_fields è l'elenco dei campi importati, separati da virgola).
export const isFromHealth = (row, field) => (row.health_fields || '').split(',').includes(field);

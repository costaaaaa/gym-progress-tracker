import { BODY_LB_DIVISIONS, formatWeightInUnit } from '../../utils/weightUnit';
import { formatLengthInUnit } from '../../utils/lengthUnit';
import { formatMeasureText, intlLocale } from '../../i18n/format';
import HealthMark from './HealthMark';
import { LENGTH_FIELDS, isFromHealth } from './series';

const StatValue = ({ row, field, weightUnit }) => {
  if (!row[field]) return '-';
  return (
    <>
      {field === 'weight' ? formatWeightInUnit(row[field], weightUnit, intlLocale(), { lbDivisions: BODY_LB_DIVISIONS, unit: false })
        : LENGTH_FIELDS.includes(field) ? formatLengthInUnit(row[field], weightUnit, intlLocale(), { unit: false })
          : formatMeasureText(row[field])}
      {isFromHealth(row, field) && <HealthMark />}
    </>
  );
};

export default StatValue;

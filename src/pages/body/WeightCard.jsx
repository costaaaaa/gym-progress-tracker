import { useTranslation } from 'react-i18next';
import ChartCard from '../../components/ChartCard';
import { formatDate, intlLocale } from '../../i18n/format';
import { BODY_LB_DIVISIONS, formatWeightInUnit, kgToDisplay, weightUnitLabel } from '../../utils/weightUnit';
import { PERIOD_UI, periodWeightDelta, weightTrend } from '../../utils/bodyStatsPeriod';
import { CHART_LINE_COLOR, lastValueOf } from './series';

// Andamento del peso nel periodo: grafico, ultimo valore e variazione. `data` sono le righe del periodo con `day`.
const WeightCard = ({ data, domain, period, weightUnit }) => {
  const { t } = useTranslation();
  const weighed = data.filter(d => d.weight !== null && d.weight !== undefined);
  const weightPoints = weighed.map(d => ({ x: d.day, value: kgToDisplay(d.weight, weightUnit, BODY_LB_DIVISIONS) }));
  const weightRows = weighed.map(d => [formatDate(d.date), formatWeightInUnit(d.weight, weightUnit, intlLocale(), { lbDivisions: BODY_LB_DIVISIONS })]);
  const lastWeight = lastValueOf(data, 'weight');
  const weightLabel = formatWeightInUnit(lastWeight, weightUnit, intlLocale(), { lbDivisions: BODY_LB_DIVISIONS });
  const weightDelta = periodWeightDelta(data);
  const trend = weightTrend(weightDelta);
  const deltaText = trend === null ? undefined
    : trend === 'flat' ? t(PERIOD_UI[period].stable)
      : t(PERIOD_UI[period].delta, { delta: formatWeightInUnit(weightDelta, weightUnit, intlLocale(), { lbDivisions: BODY_LB_DIVISIONS, signed: true, maxDecimals: 1 }) });

  return (
    <ChartCard
      title={t('body.weight_trend', { unit: weightUnitLabel(weightUnit) })}
      points={weightPoints}
      domain={domain}
      color={CHART_LINE_COLOR}
      valueLabel={weightLabel}
      trend={trend}
      deltaText={deltaText}
      ariaLabel={t('body.weight_chart_aria', { title: t('body.weight_trend', { unit: weightUnitLabel(weightUnit) }), value: weightLabel })}
      table={{ head: [t('body.col.date'), t('body.col.weight')], rows: weightRows }}
    />
  );
};

export default WeightCard;

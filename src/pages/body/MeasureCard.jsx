import { Box, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { buildPoints } from '../../components/ChartCard';
import { CHART_LINE_COLOR, hasValue, lastValueOf, measureText } from './series';

const SPARK_W = 120;
const SPARK_H = 36;

// Una misura: nome, mini grafico con la sua scala (da 2 punti) e ultimo valore
const MeasureRow = ({ series, data, domain, weightUnit }) => {
  const { t } = useTranslation();
  const value = lastValueOf(data, series.key);
  const points = data.filter((d) => hasValue(d[series.key])).map((d) => ({ x: d.day, value: Number(d[series.key]) }));
  const polyline = points.length >= 2 ? buildPoints(points, domain, SPARK_W, SPARK_H, 4) : '';
  return (
    <Box data-measure-row sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, py: 1.25 }}>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 16 }}>{t(series.label)}</Typography>
      {polyline && (
        <Box sx={{ width: { xs: 72, md: 160 }, height: { xs: 28, md: 32 }, flexShrink: 0, color: CHART_LINE_COLOR }}>
          <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </Box>
      )}
      <Typography variant="statNumber" sx={{ fontSize: 16, minWidth: { xs: 72, md: 96 }, textAlign: 'right' }}>
        {value !== null ? measureText(series, value, weightUnit) : '—'}
      </Typography>
    </Box>
  );
};

const MeasureCard = ({ title, series, data, domain, weightUnit }) => (
  <Card sx={{ p: '22px' }}>
    <Typography variant="cardTitle" sx={{ mb: 0.5 }}>{title}</Typography>
    {series.map((s) => <MeasureRow key={s.key} series={s} data={data} domain={domain} weightUnit={weightUnit} />)}
  </Card>
);

export default MeasureCard;

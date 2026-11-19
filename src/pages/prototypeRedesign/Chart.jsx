// PROTOTIPO (da buttare): grafico a linea semplice con valore minimo e massimo
import { Box, Typography } from '@mui/material';
import { TABULAR } from '../../utils/fonts';

const Chart = ({ values, height = 120, unit = '' }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${92 - ((v - min) / span) * 84}`).join(' ');
  return (
    <Box>
      <Box component="svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Grafico da ${min}${unit} a ${max}${unit}`} sx={{ width: '100%', height, display: 'block', color: 'primary.text' }}>
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', ...TABULAR }}>
        <Typography variant="caption" color="text.secondary">min {String(min).replace('.', ',')}{unit}</Typography>
        <Typography variant="caption" color="text.secondary">max {String(max).replace('.', ',')}{unit}</Typography>
      </Box>
    </Box>
  );
};

export default Chart;

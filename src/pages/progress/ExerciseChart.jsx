import { Box, Typography, useTheme } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { dayTime } from '../../utils/calendarDay';
import { kgToDisplay } from '../../utils/weightUnit';
import { radius } from '../../theme/radius';
import { formatValue, positionLabel } from './exerciseText';

// Il punto di un record è grande e col contorno, gli altri sono piccoli
export const PRDot = ({ cx, cy, payload, color, dotOutline }) => {
  if (cx === undefined || cy === undefined) return null;
  return payload.isPR
    ? <circle cx={cx} cy={cy} r={6} fill={color} stroke={dotOutline} strokeWidth={2} />
    : <circle cx={cx} cy={cy} r={3} fill={color} />;
};

export const ChartTooltip = ({ active, payload, mode, t, weightUnit }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const position = positionLabel(t, p.position);
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.md, p: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>{p.dateLabel}</Typography>
      {position && <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 0.5 }}>{position}</Typography>}
      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
        {t(`progress.kind.${mode}`)}: <strong>{formatValue(t, mode, p.value, weightUnit)}</strong>
        {p.isPR && ` · ${t('progress.pr')}`}
      </Typography>
    </Box>
  );
};

// Il grafico dell'andamento di un esercizio: una linea con le sessioni distanziate per data e i record in evidenza.
// `item`: l'esercizio analizzato (mode e sessions). Il valore disegnato è nell'unità dell'utente; il tooltip e la cronologia
// restano in kg e convertono da soli. L'immagine ha un nome che dice cosa mostra, perché i valori sono nella cronologia.
// Le etichette degli assi restano da 11px (testo dentro l'SVG di Recharts).
const ExerciseChart = ({ item, weightUnit }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  // x con l'ora: due sessioni nello stesso giorno restano punti distinti, ognuno col suo tooltip
  const chartData = item.sessions.map((s) => ({ ...s, x: dayTime(s.date), dateLabel: formatDate(s.date), shown: item.mode === 'oneRM' ? kgToDisplay(s.value, weightUnit) : s.value }));
  // Etichette dell'asse solo dove c'è una sessione
  const labelByX = new Map(chartData.map((d) => [d.x, d.dateLabel]));
  return (
    <Box sx={{ height: 240 }} role="img" aria-label={t('progress.chart_aria', { kind: t(`progress.kind.${item.mode}`), name: item.name })}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke={theme.palette.divider} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} ticks={[...labelByX.keys()]} tickFormatter={(x) => labelByX.get(x)} fontSize={11} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis fontSize={11} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} tickCount={4} width={40} domain={[(min) => Math.floor(min - 2), (max) => Math.ceil(max + 2)]} allowDecimals={false} />
          <Tooltip content={<ChartTooltip mode={item.mode} t={t} weightUnit={weightUnit} />} />
          <Line type="monotone" dataKey="shown" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={<PRDot color={theme.palette.primary.main} dotOutline={theme.palette.common.white} />} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default ExerciseChart;

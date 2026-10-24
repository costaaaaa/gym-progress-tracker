import { Box, Card, Typography } from '@mui/material';

const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 72;
const PADDING_Y = 6;

// points: [{ x, value }], con x numerica (es. un giorno); domain: [inizio, fine] dell'asse x.
export function buildPoints(points, [start, end], width = VIEWBOX_WIDTH, height = VIEWBOX_HEIGHT, paddingY = PADDING_Y) {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) {
    const y = height / 2;
    return `0,${y} ${width},${y}`;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const span = end - start;
  return points
    .map((point, i) => {
      // Dominio di ampiezza zero (tutti alla stessa x): a distanza uguale invece di un segmento verticale
      const x = span > 0 ? ((point.x - start) / span) * width : (i / (points.length - 1)) * width;
      const y = height - paddingY - ((point.value - min) / range) * (height - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Card piatta con sparkline, mirror di ChartCard.dc.html (progetto Claude Design).
 * Usata da BodyStats; buildPoints serve anche le sparkline di Progressi.
 *
 * Props:
 * - title: titolo della card
 * - points: [{ x, value }] (x = giorno della misura, da dayNumber in utils/calendarDay), normalizzati in una polyline
 * - domain: [inizio, fine] dell'asse x, stessa unità di x
 * - color: colore della linea — token tema (es. "primary.main") o valore CSS letterale
 * - valueLabel: valore corrente mostrato in grande (stringa già formattata)
 * - trend: 'up' = ▲, 'down' = ▼, 'flat' = nessuna freccia; il delta è sempre grigio (il peso non ha una direzione buona)
 * - deltaText: testo del delta (es. "12% vs mese scorso"); se assente il delta non è renderizzato
 */
const TREND_STYLE = {
  up: { color: 'text.secondary', arrow: '▲ ' },
  down: { color: 'text.secondary', arrow: '▼ ' },
  flat: { color: 'text.secondary', arrow: '' },
};

const ChartCard = ({ title, points, domain, color = 'primary.main', valueLabel, trend = 'up', deltaText }) => {
  const polyline = buildPoints(points, domain);

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        p: '22px 22px 18px',
        height: '100%',
      }}
    >
      <Typography variant="cardTitle">{title}</Typography>

      <Box sx={{ width: '100%', height: 72, color }}>
        {polyline && (
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <polyline
              points={polyline}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="statNumber">{valueLabel}</Typography>
        {deltaText && (
          <Typography
            component="span"
            sx={{
              fontSize: 16,
              fontWeight: 600,
              color: TREND_STYLE[trend].color,
            }}
          >
            {TREND_STYLE[trend].arrow}{deltaText}
          </Typography>
        )}
      </Box>
    </Card>
  );
};

export default ChartCard;

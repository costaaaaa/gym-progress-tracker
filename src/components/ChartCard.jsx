import { Box, Card, Typography } from '@mui/material';

const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 72;
const PADDING_Y = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

// Giorno di calendario come numero, per l'asse x: accetta 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS'
// o una Date (giorno locale). In UTC, così fuso e ora legale non spostano i punti.
export const dayNumber = (date) => {
  const [y, m, d] = typeof date === 'string'
    ? date.slice(0, 10).split('-').map(Number)
    : [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

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
  const span = end - start || 1;
  return points
    .map(({ x: at, value: v }) => {
      const x = ((at - start) / span) * width;
      const y = height - paddingY - ((v - min) / range) * (height - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Card piatta con sparkline, mirror di ChartCard.dc.html (progetto Claude Design).
 * Usata da BodyStats; buildPoints serve anche le sparkline di Progressi.
 *
 * Props:
 * - title: etichetta uppercase in alto
 * - points: [{ x, value }] (x = dayNumber della data), normalizzati internamente in una polyline
 * - domain: [inizio, fine] dell'asse x, stessa unità di x
 * - color: colore della linea — token tema (es. "primary.main") o valore CSS letterale
 * - valueLabel: valore corrente mostrato in grande (stringa già formattata)
 * - trend: 'up' = delta verde con ▲, 'down' = delta rosso con ▼, 'flat' = delta grigio senza freccia
 * - deltaText: testo del delta (es. "12% vs mese scorso"); se assente il delta non è renderizzato
 */
const TREND_STYLE = {
  up: { color: 'success.main', arrow: '▲ ' },
  down: { color: 'error.main', arrow: '▼ ' },
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
      <Typography
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          fontWeight: 700,
          color: 'text.secondary',
          fontSize: 12,
        }}
      >
        {title}
      </Typography>

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

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 24, lineHeight: 1 }}>
          {valueLabel}
        </Typography>
        {deltaText && (
          <Typography
            component="span"
            sx={{
              fontSize: 12,
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

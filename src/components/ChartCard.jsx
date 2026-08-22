import React from 'react';
import { Box, Card, Typography } from '@mui/material';

const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 72;
const PADDING_Y = 6;

function buildPoints(data) {
  if (!Array.isArray(data) || data.length === 0) return '';
  if (data.length === 1) {
    const y = VIEWBOX_HEIGHT / 2;
    return `0,${y} ${VIEWBOX_WIDTH},${y}`;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = VIEWBOX_WIDTH / (data.length - 1);
  return data
    .map((v, i) => {
      const x = i * stepX;
      const y = VIEWBOX_HEIGHT - PADDING_Y - ((v - min) / range) * (VIEWBOX_HEIGHT - PADDING_Y * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Card piatta con sparkline, mirror di ChartCard.dc.html (progetto Claude Design).
 * Riusata da Progress e BodyStats.
 *
 * Props:
 * - title: etichetta uppercase in alto
 * - data: array di numeri (serie storica), normalizzato internamente in una polyline
 * - color: colore della linea — token tema (es. "primary.main") o valore CSS letterale
 * - valueLabel: valore corrente mostrato in grande (stringa già formattata)
 * - deltaUp: true = delta verde con ▲, false = delta rosso con ▼
 * - deltaText: testo del delta (es. "12% vs mese scorso"); se assente il delta non è renderizzato
 */
const ChartCard = ({ title, data, color = 'primary.main', valueLabel, deltaUp = true, deltaText }) => {
  const points = buildPoints(data);

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
        {points && (
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
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
              color: deltaUp ? 'success.main' : 'error.main',
            }}
          >
            {deltaUp ? '▲' : '▼'} {deltaText}
          </Typography>
        )}
      </Box>
    </Card>
  );
};

export default ChartCard;

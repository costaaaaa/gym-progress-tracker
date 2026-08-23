import React, { useState, useEffect } from 'react';
import { Box, Card, Typography, useTheme } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { API_BASE_URL } from '../config';

const RING_SIZE = 60;
const RING_RADIUS = 26;
const RING_STROKE = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// previewData: dati statici per mostrare la card senza autenticazione (es. landing page).
// Quando presente salta la fetch autenticata e usa direttamente quei dati.
const StreakCard = ({ previewData }) => {
  const theme = useTheme();
  const [data, setData] = useState(previewData || null);
  const [loading, setLoading] = useState(!previewData);

  useEffect(() => {
    if (previewData) return;
    fetch(`${API_BASE_URL}api/gamification/streak.php`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.success) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [previewData]);

  if (loading) return null;
  if (!data) return null;

  const { current_streak_weeks, longest_streak_weeks, this_week } = data;
  const progress = this_week.goal > 0
    ? Math.min(100, Math.round((this_week.count / this_week.goal) * 100))
    : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress / 100);
  const remaining = Math.max(0, this_week.goal - this_week.count);

  return (
    <Card sx={{ p: '22px', height: '100%' }}>
      <Typography
        sx={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 2 }}
      >
        Streak
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalFireDepartmentIcon sx={{ fontSize: 30, color: 'warning.main' }} />
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 30, lineHeight: 1, color: 'warning.main' }}>
            {current_streak_weeks}
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={theme.palette.divider}
              strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="#d50000"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </svg>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
              {this_week.count}/{this_week.goal}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ minWidth: 120 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {this_week.completed
              ? 'Settimana completata!'
              : `${remaining} ${remaining === 1 ? 'sessione' : 'sessioni'} al traguardo`}
          </Typography>
          {longest_streak_weeks > 0 && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              Record: {longest_streak_weeks} settimane
            </Typography>
          )}
        </Box>
      </Box>
    </Card>
  );
};

export default StreakCard;

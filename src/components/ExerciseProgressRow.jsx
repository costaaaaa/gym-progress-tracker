import { memo } from 'react';
import { Box, CardActionArea, IconButton, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n/format';
import { muscleLabel } from '../i18n/labels';
import { buildPoints } from './ChartCard';
import { dayTime } from '../utils/calendarDay';
import { STATUS, STATUS_TONE, showsDelta } from '../utils/progressOverview';

export const formatDaysAgo = (t, days) => {
  if (days === 0) return t('progress.today');
  if (days === 1) return t('progress.yesterday');
  return t('progress.days_ago', { count: days });
};

export const formatValue = (t, mode, value) =>
  mode === 'oneRM'
    ? `${formatNumber(value, { maximumFractionDigits: 1 })} kg`
    : `${formatNumber(value)} ${t('progress.unit.reps')}`;

const SPARK_W = 120;
const SPARK_H = 36;
const SPARK_POINTS = 12;

// Ultime sessioni distanziate per data, dalla prima all'ultima mostrata; la larghezza reale la decide il contenitore
const Sparkline = ({ sessions, color }) => {
  const points = sessions.slice(-SPARK_POINTS).map((s) => ({ x: dayTime(s.date), value: s.value }));
  if (points.length < 2) return null;
  const polyline = buildPoints(points, [points[0].x, points.at(-1).x], SPARK_W, SPARK_H, 4);
  return (
    <Box sx={{ width: { xs: 52, md: 160 }, height: { xs: 28, md: 32 }, flexShrink: 0, color }}>
      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </Box>
  );
};

const TONE_COLOR = { positive: 'success.main', negative: 'recovery.recovering', neutral: 'text.secondary', muted: 'text.disabled' };

// Una riga della panoramica: nome e ultima sessione, mini grafico, valore con variazione, stella dei preferiti
const ExerciseProgressRow = ({ item, showMuscle = false, favorite, onToggleFavorite, onOpen }) => {
  const { t } = useTranslation();
  const { name, muscle, status, deltaPct, last, mode, sessions, lastDays, recentPR } = item;
  const tone = STATUS_TONE[status];

  return (
    <Box data-exercise-row sx={{ display: 'flex', alignItems: 'center', opacity: status === STATUS.INACTIVE ? 0.6 : 1 }}>
      <CardActionArea
        onClick={() => onOpen(item.id)}
        sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, py: 1.25, px: 1, borderRadius: 1 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{name}</Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary' }} noWrap>
            {showMuscle ? `${muscleLabel(muscle)} · ` : ''}{t('progress.last_session', { when: formatDaysAgo(t, lastDays) })}
          </Typography>
        </Box>

        <Sparkline sessions={sessions} color={tone === 'positive' ? TONE_COLOR.positive : TONE_COLOR.neutral} />

        <Box sx={{ textAlign: 'right', minWidth: { xs: 76, md: 120 } }}>
          <Typography variant="statNumber" sx={{ fontSize: 18 }}>{formatValue(t, mode, last.value)}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 0.75 }}>
            {recentPR && <Typography component="span" data-row-badge sx={{ fontSize: 13, fontWeight: 700 }}>{t('progress.pr')}</Typography>}
            <Typography component="span" data-row-badge sx={{ fontSize: 14, fontWeight: 600, color: TONE_COLOR[tone] }}>
              {showsDelta(item)
                ? `${deltaPct >= 0 ? '▲' : '▼'} ${formatNumber(Math.abs(deltaPct), { maximumFractionDigits: 1 })}%`
                : t(`progress.status.${status}`)}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>

      <IconButton
        onClick={() => onToggleFavorite(item.id)}
        aria-label={favorite ? t('progress.favorite_remove') : t('progress.favorite_add')}
        aria-pressed={favorite}
        sx={{ width: 44, height: 44, color: favorite ? 'warning.main' : 'text.disabled' }}
      >
        {favorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
};

export default memo(ExerciseProgressRow);

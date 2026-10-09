import { memo } from 'react';
import { Box, Card, CardActionArea, Chip, IconButton, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n/format';
import { muscleLabel } from '../i18n/labels';
import { buildPoints } from './ChartCard';
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

const Sparkline = ({ values, color }) => {
  const data = values.slice(-SPARK_POINTS);
  if (data.length < 2) return <Box sx={{ height: SPARK_H }} />;
  const points = buildPoints(data, SPARK_W, SPARK_H, 4);
  return (
    <Box sx={{ height: SPARK_H, color }}>
      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </Box>
  );
};

const TONE_COLOR = { positive: 'success.main', negative: 'error.main', neutral: 'text.secondary', muted: 'text.disabled' };

const ExerciseProgressCard = ({ item, showMuscle = false, favorite, onToggleFavorite, onOpen }) => {
  const { t } = useTranslation();
  const { name, muscle, status, deltaPct, last, mode, sessions, lastDays, recentPR } = item;
  const inactive = status === STATUS.INACTIVE;
  const tone = STATUS_TONE[status];

  return (
    <Card sx={{ height: '100%', opacity: inactive ? 0.6 : 1, position: 'relative' }}>
      <CardActionArea onClick={() => onOpen(item.id)} sx={{ p: '16px 16px 14px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <Box sx={{ pr: 5, minHeight: showMuscle ? 44 : 24 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }} noWrap title={name}>{name}</Typography>
          {showMuscle && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{muscleLabel(muscle)}</Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 24, lineHeight: 1 }}>
            {formatValue(t, mode, last.value)}
          </Typography>
          {recentPR && <Chip size="small" color="primary" label={t('progress.pr')} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />}
        </Box>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, mt: 0.5 }}>
          {t(`progress.kind.${mode}`)}
        </Typography>

        <Box sx={{ mt: 1.5 }}>
          <Sparkline values={sessions.map((s) => s.value)} color={tone === 'positive' ? TONE_COLOR.positive : TONE_COLOR.neutral} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, gap: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: TONE_COLOR[tone] }}>
            {showsDelta(item)
              ? `${deltaPct >= 0 ? '▲' : '▼'} ${formatNumber(Math.abs(deltaPct), { maximumFractionDigits: 1 })}%`
              : t(`progress.status.${status}`)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {t('progress.last_session', { when: formatDaysAgo(t, lastDays) })}
          </Typography>
        </Box>
      </CardActionArea>

      <IconButton
        size="small"
        onClick={() => onToggleFavorite(item.id)}
        aria-label={favorite ? t('progress.favorite_remove') : t('progress.favorite_add')}
        aria-pressed={favorite}
        sx={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, color: favorite ? 'warning.main' : 'text.disabled' }}
      >
        {favorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
      </IconButton>
    </Card>
  );
};

export default memo(ExerciseProgressCard);

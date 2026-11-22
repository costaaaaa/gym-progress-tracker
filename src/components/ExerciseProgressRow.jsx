import { memo } from 'react';
import { Box, CardActionArea, IconButton, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n/format';
import { formatValue, formatDaysAgo } from '../pages/progress/exerciseText';
import { buildPoints } from './ChartCard';
import { dayTime } from '../utils/calendarDay';
import { STATUS, STATUS_TONE, showsDelta } from '../utils/progressOverview';
import { radius } from '../theme/radius';

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

// Una riga dell'elenco (un <li>): tutta la riga, tranne la stella, è il collegamento alla pagina dell'esercizio. Nome e
// ultima sessione, mini grafico, valore con variazione; la stella dei preferiti è un pulsante a sé.
const ExerciseProgressRow = ({ item, weightUnit, favorite, onToggleFavorite }) => {
  const { t } = useTranslation();
  const { name, status, deltaPct, last, mode, sessions, lastDays, recentPR, laterInSession } = item;
  const tone = STATUS_TONE[status];

  return (
    <Box component="li" data-exercise-row sx={{ listStyle: 'none', display: 'flex', alignItems: 'center', opacity: status === STATUS.INACTIVE ? 0.6 : 1, '&:not(:first-of-type)': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <CardActionArea
        component={RouterLink}
        to={`/progressi/esercizi/${item.id}`}
        sx={{ flex: 1, minWidth: 0, minHeight: 60, display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, py: 1.25, px: 1, borderRadius: radius.xxl, ...(laterInSession && { flexWrap: 'wrap', rowGap: 0 }) }}
      >
        <Box sx={{ flex: { xs: 1, md: '0 0 300px' }, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{name}</Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
            {t('progress.last_session', { when: formatDaysAgo(t, lastDays) })}
          </Typography>
        </Box>

        <Sparkline sessions={sessions} color={TONE_COLOR[tone]} />

        <Box sx={{ textAlign: 'right', minWidth: { xs: 76, md: 120 }, ml: { md: 'auto' } }}>
          <Typography variant="statNumber" sx={{ fontSize: 18 }}>{formatValue(t, mode, last.value, weightUnit)}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 0.75 }}>
            {recentPR && <Typography component="span" sx={{ fontSize: 16, fontWeight: 700 }}>{t('progress.pr')}</Typography>}
            <Typography component="span" sx={{ fontSize: 16, fontWeight: 600, color: TONE_COLOR[tone] }}>
              {showsDelta(item)
                ? `${deltaPct >= 0 ? '▲' : '▼'} ${formatNumber(Math.abs(deltaPct), { maximumFractionDigits: 1 })}%`
                : t(`progress.status.${status}`)}
            </Typography>
          </Box>
        </Box>

        {laterInSession && (
          // Riga a sé a tutta larghezza: concatenata al delta allargherebbe la colonna del valore sul telefono
          <Typography sx={{ flexBasis: '100%', textAlign: 'right', fontSize: 16, fontWeight: 600, color: TONE_COLOR[tone] }}>{t('progress.later_in_session')}</Typography>
        )}
      </CardActionArea>

      <IconButton
        onClick={() => onToggleFavorite(item.id)}
        aria-label={favorite ? t('progress.favorite_remove') : t('progress.favorite_add')}
        aria-pressed={favorite}
        sx={{ width: 44, height: 44, color: favorite ? 'warning.text' : 'text.disabled' }}
      >
        {favorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
};

export default memo(ExerciseProgressRow);

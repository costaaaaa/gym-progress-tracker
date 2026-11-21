import { alpha } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { visuallyHidden } from '@mui/utils';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/format';

// Lunedì 1 gennaio 2024: i sette giorni da lì, in UTC, con i nomi della lingua dell'app
const dayName = (index, weekday) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + index)));

const DAYS = [0, 1, 2, 3, 4, 5, 6];

// Colori dei cerchi (bordo almeno 3 : 1 sul fondo, in chiaro e in scuro). Sul rosso: bianco pieno, e il bianco al 75%
// per i giorni non fatti (3,4 : 1 sul rosso del marchio; il 55% del prototipo si fermava a 2,3 : 1).
const ON_COLOR = {
  done: { bgcolor: 'common.white', color: 'primary.main', borderColor: 'common.white' },
  today: { bgcolor: 'transparent', color: 'common.white', borderColor: 'common.white' },
  todo: { bgcolor: 'transparent', color: 'common.white', borderColor: (theme) => alpha(theme.palette.common.white, 0.75) },
};
const ON_NEUTRAL = {
  done: { bgcolor: 'success.main', color: 'success.contrastText', borderColor: 'success.main' },
  today: { bgcolor: 'transparent', color: 'text.primary', borderColor: 'text.primary' },
  todo: { bgcolor: 'transparent', color: 'text.primary', borderColor: 'fieldBorder' },
};

// `done`: sette booleani da lunedì; `today`: indice 0-6 (-1 se non si sa); `onColor`: sul campo rosso
const WeekDays = ({ done, today, onColor = false }) => {
  const { t } = useTranslation();
  const list = new Intl.ListFormat(intlLocale(), { style: 'long', type: 'conjunction' });
  const doneNames = DAYS.filter((i) => done[i]).map((i) => dayName(i, 'long'));
  const description = [
    doneNames.length > 0 ? t('home.week.sr_done', { days: list.format(doneNames) }) : t('home.week.sr_none'),
    today >= 0 ? t('home.week.sr_today', { day: dayName(today, 'long') }) : null,
  ].filter(Boolean).join(' ');
  const palette = onColor ? ON_COLOR : ON_NEUTRAL;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
      <Box component="span" sx={visuallyHidden}>{description}</Box>
      {DAYS.map((i) => {
        const isDone = Boolean(done[i]);
        const isToday = i === today;
        const colors = palette[isDone ? 'done' : isToday ? 'today' : 'todo'];
        return (
          <Box key={i} data-day aria-hidden="true" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Box
              data-circle
              data-done={isDone}
              data-today={isToday}
              sx={{
                width: 30, height: 30, boxSizing: 'border-box', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `${isToday ? 3 : 2}px solid`, ...colors,
              }}
            >
              {isDone && <CheckIcon sx={{ fontSize: 18 }} />}
            </Box>
            <Typography variant="caption" sx={{ color: onColor ? 'common.white' : isToday ? 'text.primary' : 'text.secondary', fontWeight: isToday ? 700 : undefined }}>
              {dayName(i, 'narrow')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default WeekDays;

import { useMemo } from 'react';
import { Box, ButtonBase, Card, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { format } from 'date-fns';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, intlLocale } from '../../i18n/format';
import { clockDay, shiftDay } from '../../utils/calendarDay';
import { isMonthKey, monthCells, monthOf, shiftMonth } from './calendarMonth';
import WorkoutListItem from './WorkoutListItem';

const FULL_DAY = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const DAY_AND_MONTH = { day: 'numeric', month: 'long' };
const MAX_DOTS = 3;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Il nome del mese e le iniziali dei giorni vengono da Intl nella lingua corrente. Il 5 gennaio 2026 è un lunedì.
const weekdayInitials = () => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i)).toLocaleDateString(intlLocale(), { weekday: 'narrow', timeZone: 'UTC' }));

const validDay = (value) => (DAY_RE.test(value ?? '') && shiftDay(value, 0) === value ? value : null);

// Indirizzo del calendario: sempre `vista`, poi il mese e il giorno quando ci sono, nello stesso ordine
const calendarParams = (month, day) => {
  const params = new URLSearchParams({ vista: 'calendario' });
  if (month) params.set('mese', month);
  if (day) params.set('giorno', day);
  return params;
};

// La vista «Calendario» dello Storico: una card col mese (un segno nei giorni allenati) e, sotto, quella del giorno scelto con
// le stesse righe dell'elenco. Mese e giorno stanno nell'indirizzo (?mese=2026-11&giorno=2026-11-18), così «indietro» dalla
// pagina di un allenamento torna qui com'era. Senza indirizzo: il mese corrente e oggi. `workouts` sono già quelli da mostrare.
const HistoryCalendar = ({ workouts, summaries, weightUnit }) => {
  const { t } = useTranslation();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();

  // Il giorno di un allenamento è quello scritto nella sua data, come nell'elenco
  const byDay = useMemo(() => {
    const days = {};
    workouts.forEach((workout) => {
      const day = clockDay(workout.date);
      if (day) (days[day] ||= []).push(workout);
    });
    return days;
  }, [workouts]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonth = monthOf(today);
  const trainedDays = Object.keys(byDay).sort();
  const firstMonth = trainedDays.length > 0 ? monthOf(trainedDays[0]) : currentMonth;

  const monthParam = isMonthKey(params.get('mese')) ? params.get('mese') : null;
  const dayParam = validDay(params.get('giorno'));
  const requestedMonth = monthParam || (dayParam ? monthOf(dayParam) : currentMonth);
  const month = [firstMonth, requestedMonth, currentMonth].sort()[1]; // dentro i limiti: dal primo allenamento al mese corrente
  // Senza né mese né giorno nell'indirizzo il giorno scelto è oggi; con un mese e senza giorno, nessuno
  let selected = dayParam ?? (monthParam ? null : today);
  if (selected && (monthOf(selected) !== month || selected > today)) selected = null;

  const go = (nextMonth, nextDay) => setParams(calendarParams(nextMonth, nextDay), { replace: true });
  const chooseDay = (day) => go(monthParam && month, day);
  const changeMonth = (delta) => {
    const next = shiftMonth(month, delta);
    const lastTrained = trainedDays.filter((day) => monthOf(day) === next && day <= today).pop();
    go(next, lastTrained);
  };

  const heading = formatDate(`${month}-01`, { month: 'long', year: 'numeric' });
  const dayWorkouts = selected ? byDay[selected] ?? [] : [];

  return (
    <>
      <Card component="section" aria-labelledby="history-calendar-month" sx={{ mb: 3.5, p: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
          <IconButton aria-label={t('history.calendar.prev')} disabled={month <= firstMonth} onClick={() => changeMonth(-1)} sx={{ width: 44, height: 44 }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography id="history-calendar-month" component="h2" variant="cardTitle" sx={{ textAlign: 'center' }}>{heading}</Typography>
          <IconButton aria-label={t('history.calendar.next')} disabled={month >= currentMonth} onClick={() => changeMonth(1)} sx={{ width: 44, height: 44 }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
        {/* Le iniziali non hanno nome utile: ogni giorno si legge già per esteso */}
        <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', mb: 0.5 }}>
          {weekdayInitials().map((initial, i) => (
            <Typography key={i} sx={{ fontSize: 16, color: 'text.secondary', textAlign: 'center' }}>{initial}</Typography>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {monthCells(month).map((day, i) => {
            if (!day) return <Box key={`vuota-${i}`} />;
            const count = byDay[day]?.length ?? 0;
            const date = formatDate(day, DAY_AND_MONTH);
            return (
              <ButtonBase
                key={day}
                data-day={day}
                disabled={day > today}
                aria-pressed={day === selected}
                aria-current={day === today ? 'date' : undefined}
                aria-label={count > 0 ? t('history.calendar.day', { date, count }) : date}
                onClick={() => chooseDay(day)}
                sx={{
                  minHeight: 44, flexDirection: 'column', justifyContent: 'center', gap: '2px', borderRadius: 1,
                  border: '2px solid', borderColor: day === selected ? 'text.primary' : 'transparent',
                  '&.Mui-disabled': { color: 'text.disabled' },
                }}
              >
                <Typography component="span" sx={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', fontWeight: day === today ? 700 : 400, textDecoration: day === today ? 'underline' : 'none' }}>
                  {Number(day.slice(8))}
                </Typography>
                {/* Un pallino per allenamento, fino a tre: il numero vero sta nel nome del pulsante */}
                <Box aria-hidden="true" sx={{ display: 'flex', gap: '3px', height: 6 }}>
                  {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, n) => (
                    <Box key={n} data-day-dot sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                  ))}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
      </Card>

      {selected && (
        <Card component="section" aria-labelledby="history-calendar-day" sx={{ mb: 3.5 }}>
          <Typography id="history-calendar-day" component="h2" variant="cardTitle" sx={{ px: 2.5, pt: 2, pb: 1 }}>{formatDate(selected, FULL_DAY)}</Typography>
          {dayWorkouts.length > 0 ? (
            <Box component="ul" sx={{ m: 0, p: 0 }}>
              {dayWorkouts.map((workout) => (
                <WorkoutListItem key={workout.id} workout={workout} summary={summaries[workout.id]} weightUnit={weightUnit} linkState={{ historySearch: search }} />
              ))}
            </Box>
          ) : (
            <Typography sx={{ px: 2.5, pb: 2.5, fontSize: 16, color: 'text.secondary' }}>{t('history.calendar.empty_day')}</Typography>
          )}
        </Card>
      )}
    </>
  );
};

export default HistoryCalendar;

import { useMemo } from 'react';
import { Box, ButtonBase, Card, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatDate, intlLocale } from '../../i18n/format';
import { clockDay } from '../../utils/calendarDay';
import { monthCells, monthOf, shiftMonth } from './calendarMonth';
import { calendarParams } from './historyAddress';
import WorkoutGroupCard from './WorkoutGroupCard';

const FULL_DAY = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const DAY_AND_MONTH = { day: 'numeric', month: 'long' };
const MAX_DOTS = 3;

// Il nome del mese e le iniziali dei giorni vengono da Intl nella lingua corrente. Il 5 gennaio 2026 è un lunedì.
const weekdayInitials = () => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i)).toLocaleDateString(intlLocale(), { weekday: 'narrow', timeZone: 'UTC' }));

// La vista «Calendario» dello Storico: una card col mese (un segno nei giorni allenati) e, sotto, quella del giorno scelto con
// le stesse righe dell'elenco. Mese e giorno stanno nell'indirizzo, che è di History: `address` ne sono mese e giorno già
// letti (null se assenti o non validi), `replaceAddress(parametri)` lo cambia sostituendo la voce di cronologia, `backTo` è
// l'indirizzo intero, che le righe portano alla pagina dell'allenamento. Senza mese né giorno: il mese corrente e oggi.
// `workouts` sono già quelli da mostrare. Un giorno futuro si sceglie solo se ha allenamenti (capita con un altro fuso).
const HistoryCalendar = ({ workouts, summaries, weightUnit, address, replaceAddress, backTo }) => {
  const { t } = useTranslation();

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
  // I limiti dei mesi: dal primo allenamento (o dal mese corrente, se è prima) all'ultimo (o al corrente), sempre in ordine
  const firstMonth = [currentMonth, ...trainedDays.slice(0, 1).map(monthOf)].sort()[0];
  const lastMonth = [currentMonth, ...trainedDays.slice(-1).map(monthOf)].sort().pop();
  const isOff = (day) => day > today && !byDay[day];

  // Un giorno non valido o spento vale assente; senza né mese né giorno il giorno scelto è oggi, con un mese e senza giorno nessuno
  const requestedDay = address.day && !isOff(address.day) ? address.day : null;
  const requestedMonth = address.month || (requestedDay ? monthOf(requestedDay) : currentMonth);
  const month = requestedMonth < firstMonth ? firstMonth : requestedMonth > lastMonth ? lastMonth : requestedMonth;
  let selected = requestedDay ?? (address.month ? null : today);
  if (selected && monthOf(selected) !== month) selected = null;

  const chooseDay = (day) => replaceAddress(calendarParams(address.month && month, day));
  const changeMonth = (delta) => {
    const next = shiftMonth(month, delta);
    replaceAddress(calendarParams(next, trainedDays.filter((day) => monthOf(day) === next).pop()));
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
          <IconButton aria-label={t('history.calendar.next')} disabled={month >= lastMonth} onClick={() => changeMonth(1)} sx={{ width: 44, height: 44 }}>
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
                disabled={isOff(day)}
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
        <WorkoutGroupCard
          id="history-calendar-day"
          title={formatDate(selected, FULL_DAY)}
          workouts={dayWorkouts}
          summaries={summaries}
          weightUnit={weightUnit}
          backTo={backTo}
          empty={t('history.calendar.empty_day')}
        />
      )}
    </>
  );
};

export default HistoryCalendar;

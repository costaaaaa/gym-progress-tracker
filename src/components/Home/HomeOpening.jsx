import { Box, Button, Card, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WeekDays from './WeekDays';
import { workoutLine } from './workoutLine';
import { isRedState } from '../../utils/homeState';
import { TABULAR, TITLE_FONT_FAMILY } from '../../utils/fonts';
import { radius } from '../../theme/radius';

const LABEL = { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' };
const DAY_TITLE = { fontFamily: TITLE_FONT_FAMILY, fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 };

// Saluto con lo username: l'unico h1 della Home
export const Greeting = ({ name, sx }) => {
  const { t } = useTranslation();
  return (
    <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, ...sx }}>
      {t('home.greeting', { name })}
    </Typography>
  );
};

// «Settimana», «2 di 4 allenamenti» e i sette giorni
const WeekBlock = ({ weeklyWorkouts, weeklyGoal, weekDays, todayIdx, onColor }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 1, mb: 1.25 }}>
        <Typography sx={LABEL}>{t('home.week.label')}</Typography>
        {weeklyGoal > 0 && (
          <Typography sx={{ fontWeight: 600, ...TABULAR }}>
            {t('home.week.progress', { done: weeklyWorkouts, count: weeklyGoal })}
          </Typography>
        )}
      </Box>
      <WeekDays done={weekDays} today={todayIdx} onColor={onColor} />
    </Box>
  );
};

// Frase sotto il saluto, secondo lo stato
const statusSentence = (t, { state, nextDay, dayName, weeklyWorkouts, weeklyGoal }) => {
  const week = weeklyGoal > 0 ? t('home.state.week', { count: weeklyWorkouts, goal: weeklyGoal }) : null;
  if (state === 'resume') return t('home.state.resume', { day: dayName });
  if (state === 'goal') return t('home.state.goal', { count: weeklyWorkouts, goal: weeklyGoal });
  if (state === 'done') return [t('home.state.done'), week].filter(Boolean).join(' ');
  return [nextDay ? t('home.state.todo_day', { day: nextDay.name }) : null, week].filter(Boolean).join(' ');
};

const startState = (nextDay) => (nextDay ? { suggestedDayId: nextDay.id } : undefined);

// Apertura rossa («todo» e «resume»): oggi c'è ancora da allenarsi. Sul telefono il campo arriva ai bordi (il Layout lo
// attacca alla barra rossa), da md in su è un pannello con gli angoli tondi: Oggi a sinistra, Settimana a destra.
const RedOpening = ({ props, sentence }) => {
  const { t } = useTranslation();
  const { state, name, nextDay, draftDayName, weeklyWorkouts, weeklyGoal, weekDays, todayIdx } = props;
  const resume = state === 'resume';
  const title = resume ? draftDayName : nextDay?.name;
  return (
    <Box
      data-red-field
      sx={{
        bgcolor: 'primary.main',
        color: '#fff',
        px: { xs: 2, md: 4 },
        pt: { xs: 2, md: 4 },
        pb: { xs: 3, md: 4 },
        borderRadius: { xs: '0 0 28px 28px', md: '28px' },
      }}
    >
      <Greeting name={name} sx={{ lineHeight: 1.2 }} />
      <Typography sx={{ fontSize: 15, mt: 0.5, mb: 2.5, lineHeight: 1.5 }}>{sentence}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 6, rowGap: 2.5, alignItems: 'start' }}>
        <Box>
          {title && (
            <>
              <Typography sx={LABEL}>{t('home.today.label')}</Typography>
              <Typography sx={{ ...DAY_TITLE, mt: 0.25 }}>{title}</Typography>
              {!resume && nextDay && <Typography sx={{ mb: 0.5 }}>{t('home.today.exercises', { count: nextDay.exercises })}</Typography>}
            </>
          )}
          <Button
            component={RouterLink}
            to="/focus"
            state={resume ? undefined : startState(nextDay)}
            fullWidth
            size="large"
            sx={{
              mt: 1,
              py: 1.4,
              fontWeight: 700,
              borderRadius: radius.xl,
              bgcolor: '#fff',
              color: 'primary.main',
              '&:hover': { bgcolor: '#f7f6f5' },
              // Il contorno scuro del tema sul rosso dà 3,2 : 1: bianco (5,5 : 1)
              '&.Mui-focusVisible': { outlineColor: '#fff' },
            }}
          >
            {t(resume ? 'home.today.resume' : 'home.today.start')}
          </Button>
        </Box>
        <WeekBlock weeklyWorkouts={weeklyWorkouts} weeklyGoal={weeklyGoal} weekDays={weekDays} todayIdx={todayIdx} onColor />
      </Box>
    </Box>
  );
};

const outlineButton = { py: 1.2, fontWeight: 700, borderRadius: radius.xl, minHeight: 48 };

// Apertura neutra («done» e «goal»): saluto e frase su fondo normale, poi la card con la seduta e la settimana
const NeutralOpening = ({ props, sentence }) => {
  const { t } = useTranslation();
  const { state, name, nextDay, todayRecord, weightUnit, weeklyWorkouts, weeklyGoal, weekDays, todayIdx } = props;
  const done = state === 'done';
  const line = done ? workoutLine(todayRecord, weightUnit, t) : '';
  return (
    <Box>
      <Greeting name={name} sx={{ lineHeight: 1.2 }} />
      <Typography sx={{ fontSize: 15, mt: 0.5, mb: 2, lineHeight: 1.5 }}>{sentence}</Typography>
      <Card data-card sx={{ p: { xs: 2, md: '22px' } }}>
        {done ? (
          <>
            <Typography sx={{ ...LABEL, color: 'text.secondary' }}>{t('home.today.label')}</Typography>
            <Typography sx={{ ...DAY_TITLE, mt: 0.5 }}>{todayRecord?.day_name || t('home.today.workout_fallback')}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
              <CheckCircleIcon aria-hidden="true" sx={{ fontSize: 20, color: 'success.title' }} />
              <Typography sx={{ fontWeight: 700, color: 'success.title' }}>{t('home.today.completed')}</Typography>
            </Box>
            {line && <Typography sx={{ color: 'text.secondary', mb: 1.5, ...TABULAR }}>{line}</Typography>}
            <Button
              component={RouterLink}
              to="/storico"
              variant="outlined"
              fullWidth
              size="large"
              sx={{ ...outlineButton, mt: line ? 0 : 1.5, color: 'text.primary', borderColor: 'text.secondary', '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' } }}
            >
              {t('home.today.see_workout')}
            </Button>
            {nextDay && (
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1.25, textAlign: 'center' }}>
                {t('home.today.next', { day: nextDay.name })}
              </Typography>
            )}
          </>
        ) : (
          <>
            {nextDay && (
              <>
                <Typography sx={{ ...LABEL, color: 'text.secondary' }}>{t('home.today.next_label')}</Typography>
                <Typography sx={{ ...DAY_TITLE, mt: 0.5 }}>{nextDay.name}</Typography>
                <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>{t('home.today.exercises', { count: nextDay.exercises })}</Typography>
              </>
            )}
            <Button
              component={RouterLink}
              to="/focus"
              state={startState(nextDay)}
              variant="outlined"
              fullWidth
              size="large"
              sx={{ ...outlineButton, color: 'primary.text', borderColor: 'primary.text', '&:hover': { borderColor: 'primary.text', bgcolor: 'action.hover' } }}
            >
              {t('home.today.start')}
            </Button>
          </>
        )}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 2, pt: 1.5 }}>
          <WeekBlock weeklyWorkouts={weeklyWorkouts} weeklyGoal={weeklyGoal} weekDays={weekDays} todayIdx={todayIdx} onColor={false} />
        </Box>
      </Card>
    </Box>
  );
};

// `state`: 'todo' | 'resume' | 'done' | 'goal' (utils/homeState). `nextDay`: {id, name, exercises} o null; `draftDayName`: il
// giorno della bozza; `todayRecord`: l'allenamento di oggi (stato «done»); `weekDays`: sette booleani da lunedì.
const HomeOpening = (props) => {
  const { t } = useTranslation();
  const dayName = props.draftDayName || t('home.today.workout_fallback');
  const sentence = statusSentence(t, { ...props, dayName });
  return isRedState(props.state)
    ? <RedOpening props={{ ...props, draftDayName: dayName }} sentence={sentence} />
    : <NeutralOpening props={props} sentence={sentence} />;
};

export default HomeOpening;

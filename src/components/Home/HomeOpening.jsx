import { alpha } from '@mui/material/styles';
import { Box, Button, Card, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WeekDays from './WeekDays';
import { workoutLine } from './workoutLine';
import { TABULAR, TITLE_FONT_FAMILY } from '../../utils/fonts';
import { radius } from '../../theme/radius';
import { LABEL } from './labelStyle';

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

// «Settimana», «2 di 4 allenamenti» e i sette giorni. `week`: { workouts, goal, days, todayIdx }
const WeekBlock = ({ week, onColor }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 1, mb: 1.25 }}>
        <Typography sx={LABEL}>{t('home.week.label')}</Typography>
        {week.goal > 0 && (
          <Typography sx={{ fontWeight: 600, ...TABULAR }}>
            {t('home.week.progress', { done: week.workouts, count: week.goal })}
          </Typography>
        )}
      </Box>
      <WeekDays done={week.days} today={week.todayIdx} onColor={onColor} />
    </Box>
  );
};

// Cosa dice e mostra ogni stato, deciso qui e letto dai due componenti:
// red (campo rosso o card neutra), sentence (frase sotto il saluto, '' se non c'è nulla da dire), label e title (del blocco
// con il giorno), completed (la seduta di oggi è fatta), button (testo e se porta il giorno proposto al Focus).
const describeState = (t, { state, nextDay, draftDayName, week }) => {
  const weekSentence = week.goal > 0 ? t('home.state.week', { count: week.workouts, goal: week.goal }) : null;
  const join = (...parts) => parts.filter(Boolean).join(' ');
  const start = { label: t('home.today.start'), suggestsDay: true };
  switch (state) {
    case 'resume': {
      const title = draftDayName || t('home.today.workout_fallback');
      return { red: true, sentence: t('home.state.resume', { day: title }), label: t('home.today.label'), title, button: { label: t('home.today.resume'), suggestsDay: false } };
    }
    case 'goal':
      return { red: false, sentence: t('home.state.goal', { count: week.workouts, goal: week.goal }), label: t('home.today.next_label'), title: nextDay?.name, button: start };
    case 'done':
      return { red: false, sentence: join(t('home.state.done'), weekSentence), label: t('home.today.label'), title: null, completed: true };
    default:
      return { red: true, sentence: join(nextDay ? t('home.state.todo_day', { day: nextDay.name }) : null, weekSentence), label: t('home.today.label'), title: nextDay?.name, button: start };
  }
};

// Il Focus si apre con il giorno proposto già scelto, se lo stato ne ha uno
const buttonState = (view, nextDay) => (view.button.suggestsDay && nextDay ? { suggestedDayId: nextDay.id } : undefined);

// Saluto e frase dello stato (la frase vuota non si disegna); `gap`: spazio sotto
const OpeningHead = ({ name, sentence, gap }) => (
  <>
    <Greeting name={name} sx={{ lineHeight: 1.2, mb: sentence ? 0 : gap }} />
    {sentence && <Typography sx={{ fontSize: 15, mt: 0.5, mb: gap, lineHeight: 1.5 }}>{sentence}</Typography>}
  </>
);

// Apertura rossa («todo» e «resume»): oggi c'è ancora da allenarsi. Sul telefono il campo arriva ai bordi (il Layout lo
// attacca alla barra rossa), da md in su è un pannello con gli angoli tondi: Oggi a sinistra, Settimana a destra.
const RedOpening = ({ view, name, nextDay, week }) => {
  const { title } = view;
  return (
    <Box
      data-red-field
      sx={{
        bgcolor: 'primary.main',
        color: 'common.white',
        px: { xs: 2, md: 4 },
        pt: { xs: 2, md: 4 },
        pb: { xs: 3, md: 4 },
        borderRadius: { xs: '0 0 28px 28px', md: '28px' },
      }}
    >
      <OpeningHead name={name} sentence={view.sentence} gap={2.5} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 6, rowGap: 2.5, alignItems: 'start' }}>
        <Box>
          {title && (
            <>
              <Typography sx={LABEL}>{view.label}</Typography>
              <Typography sx={{ ...DAY_TITLE, mt: 0.25 }}>{title}</Typography>
              {view.button.suggestsDay && nextDay && <ExerciseCount nextDay={nextDay} sx={{ mb: 0.5 }} />}
            </>
          )}
          <Button
            component={RouterLink}
            to="/focus"
            state={buttonState(view, nextDay)}
            fullWidth
            size="large"
            sx={{
              mt: 1,
              py: 1.4,
              fontWeight: 700,
              borderRadius: radius.xl,
              bgcolor: 'common.white',
              color: 'primary.main',
              '&:hover': { bgcolor: (theme) => alpha(theme.palette.common.white, 0.9) },
              // Il contorno scuro del tema sul rosso dà 3,2 : 1: bianco (5,5 : 1)
              '&.Mui-focusVisible': { outlineColor: 'common.white' },
            }}
          >
            {view.button.label}
          </Button>
        </Box>
        <WeekBlock week={week} onColor />
      </Box>
    </Box>
  );
};

const ExerciseCount = ({ nextDay, sx }) => {
  const { t } = useTranslation();
  return <Typography sx={sx}>{t('home.today.exercises', { count: nextDay.exercises })}</Typography>;
};

const outlineButton = { py: 1.2, fontWeight: 700, borderRadius: radius.xl, minHeight: 48 };

// Apertura neutra («done» e «goal»): saluto e frase su fondo normale, poi la card con la seduta e la settimana
const NeutralOpening = ({ view, name, nextDay, todayRecord, weightUnit, week }) => {
  const { t } = useTranslation();
  const line = view.completed ? workoutLine(todayRecord, weightUnit, t) : '';
  return (
    <Box>
      <OpeningHead name={name} sentence={view.sentence} gap={2} />
      <Card data-card sx={{ p: { xs: 2, md: '22px' } }}>
        {view.completed ? (
          <>
            <Typography sx={{ ...LABEL, color: 'text.secondary' }}>{view.label}</Typography>
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
                <Typography sx={{ ...LABEL, color: 'text.secondary' }}>{view.label}</Typography>
                <Typography sx={{ ...DAY_TITLE, mt: 0.5 }}>{view.title}</Typography>
                <ExerciseCount nextDay={nextDay} sx={{ color: 'text.secondary', mb: 1.5 }} />
              </>
            )}
            <Button
              component={RouterLink}
              to="/focus"
              state={buttonState(view, nextDay)}
              variant="outlined"
              fullWidth
              size="large"
              sx={{ ...outlineButton, color: 'primary.text', borderColor: 'primary.text', '&:hover': { borderColor: 'primary.text', bgcolor: 'action.hover' } }}
            >
              {view.button.label}
            </Button>
          </>
        )}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 2, pt: 1.5 }}>
          <WeekBlock week={week} onColor={false} />
        </Box>
      </Card>
    </Box>
  );
};

// `state`: 'todo' | 'resume' | 'done' | 'goal' (utils/homeState). `nextDay`: {id, name, exercises} o null; `draftDayName`: il
// giorno della bozza (stato «resume»); `todayRecord`: l'allenamento di oggi o null (stato «done»);
// `week`: { workouts, goal, days (sette booleani da lunedì), todayIdx }.
const HomeOpening = ({ state, name, nextDay, draftDayName, todayRecord, weightUnit, week }) => {
  const { t } = useTranslation();
  const view = describeState(t, { state, nextDay, draftDayName, week });
  return view.red
    ? <RedOpening view={view} name={name} nextDay={nextDay} week={week} />
    : <NeutralOpening view={view} name={name} nextDay={nextDay} todayRecord={todayRecord} weightUnit={weightUnit} week={week} />;
};

export default HomeOpening;

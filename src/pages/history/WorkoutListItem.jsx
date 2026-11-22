import { Box, ButtonBase, Typography } from '@mui/material';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatClockTime, formatDate } from '../../i18n/format';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { durationText, volumeText, workoutTitle } from './workoutText';

const SHORT_DAY = { weekday: 'short', day: 'numeric', month: 'short' };

// Una riga dell'elenco: tutta la riga è il collegamento alla pagina dell'allenamento. Titolo = giorno della scheda (o la
// data, e allora sotto c'è l'ora); sotto, data, durata e volume quando ci sono. A destra il segno «Record» se l'allenamento
// ne ha battuto uno vero. `summary`: volume e record di questo allenamento (workoutSummaries). `linkState`: lo stato di
// navigazione che il collegamento porta alla pagina dell'allenamento (il calendario vi mette il suo indirizzo, per tornarci).
const WorkoutListItem = ({ workout, summary, weightUnit, linkState }) => {
  const { t } = useTranslation();
  const details = [
    workout.day_name ? formatDate(workout.date, SHORT_DAY) : formatClockTime(workout.date),
    durationText(workout.duration_seconds),
    summary.volumeKg > 0 && volumeText(summary.volumeKg, weightUnit),
  ].filter(Boolean).join(' · ');

  return (
    <Box component="li" sx={{ listStyle: 'none', '&:not(:first-of-type)': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <ButtonBase
        component={RouterLink}
        to={`/storico/${workout.id}`}
        state={linkState}
        data-workout-row={workout.id}
        sx={{ width: '100%', minHeight: 60, px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, textAlign: 'left' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 16, overflowWrap: 'anywhere' }}>{workoutTitle(workout)}</Typography>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{details}</Typography>
        </Box>
        {summary.records.length > 0 && <EmojiEventsOutlinedIcon titleAccess={t('history.pr.label')} sx={{ color: 'text.secondary', flexShrink: 0 }} />}
      </ButtonBase>
    </Box>
  );
};

export default WorkoutListItem;

import { useContext } from 'react';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workoutLine } from './workoutLine';
import { formatDate, intlLocale } from '../../i18n/format';
import { LABEL } from './homeStyles';
import { TABULAR } from '../../utils/fonts';
import { BlockEditContext } from './blocks/blockEdit';

// «Mercoledì 18 novembre»: iniziale maiuscola, e l'anno solo se non è quello di oggi. L'anno di oggi viene dalla data
// del server (`today`, 'YYYY-MM-DD'), non dall'orologio del dispositivo; senza, l'anno si mostra sempre.
const longDate = (date, today) => {
  const sameYear = Boolean(today) && String(date).slice(0, 4) === String(today).slice(0, 4);
  const text = formatDate(date, { weekday: 'long', ...(sameYear ? {} : { year: 'numeric' }), month: 'long', day: 'numeric' });
  return text.charAt(0).toLocaleUpperCase(intlLocale()) + text.slice(1);
};

// Blocco piccolo con l'ultimo allenamento; tutto porta allo Storico. `today`: la data di oggi del server.
// In «Modifica Home» (`BlockEditContext`) non è un link, sotto ci sono i comandi, e senza allenamento (`record` null)
// resta il titolo.
const LastWorkout = ({ record, weightUnit, today }) => {
  const { t } = useTranslation();
  const controls = useContext(BlockEditContext);
  const line = record ? workoutLine(record, weightUnit, t) : null;
  const body = (
    <>
      <Typography component="h2" sx={{ ...LABEL, color: 'text.secondary', mb: 0.5 }}>
        {t('home.last.title')}
      </Typography>
      {record?.day_name && <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{record.day_name}</Typography>}
      {record && (
        <Typography sx={{ color: 'text.secondary' }}>
          {longDate(record.date, today)}
        </Typography>
      )}
      {line && <Typography sx={{ color: 'text.secondary', ...TABULAR }}>{line}</Typography>}
    </>
  );
  return (
    <Card>
      {controls ? (
        <Box sx={{ p: 2.5, pb: 1 }}>{body}</Box>
      ) : (
        <CardActionArea component={RouterLink} to="/storico" sx={{ p: 2.5 }}>{body}</CardActionArea>
      )}
      {controls}
    </Card>
  );
};

export default LastWorkout;

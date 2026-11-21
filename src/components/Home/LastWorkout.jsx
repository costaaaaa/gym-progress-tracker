import { Card, CardActionArea, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workoutLine } from './workoutLine';
import { formatDate } from '../../i18n/format';
import { TABULAR } from '../../utils/fonts';

// Blocco piccolo con l'ultimo allenamento; tutto porta allo Storico
const LastWorkout = ({ record, weightUnit }) => {
  const { t } = useTranslation();
  const line = workoutLine(record, weightUnit, t);
  return (
    <Card>
      <CardActionArea component={RouterLink} to="/storico" sx={{ p: 2.5 }}>
        <Typography component="h2" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'text.secondary', mb: 0.5 }}>
          {t('home.last.title')}
        </Typography>
        {record.day_name && <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{record.day_name}</Typography>}
        <Typography sx={{ color: 'text.secondary' }}>
          {formatDate(record.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>
        {line && <Typography sx={{ color: 'text.secondary', ...TABULAR }}>{line}</Typography>}
      </CardActionArea>
    </Card>
  );
};

export default LastWorkout;

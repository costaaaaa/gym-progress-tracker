import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { workoutZoneBadge } from '../utils/workoutTime';

// Accanto all'orario di un allenamento fatto in un fuso diverso da quello del dispositivo ("New York · UTC−4")
const TimeZoneBadge = ({ workout, sx }) => {
  const { t } = useTranslation();
  const label = workoutZoneBadge(workout);
  if (!label) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      aria-label={t('history.time_zone_aria', { zone: label })}
      sx={{ borderColor: 'divider', color: 'text.secondary', fontWeight: 600, ...sx }}
    />
  );
};

export default TimeZoneBadge;

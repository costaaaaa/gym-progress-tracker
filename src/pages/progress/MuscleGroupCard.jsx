import { Box, Card, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../../i18n/labels';
import ExerciseProgressRow from '../../components/ExerciseProgressRow';

// Una card per gruppo muscolare, sempre aperta: titolo h2 (che dà il nome alla sezione) con il numero di esercizi accanto,
// e una riga-collegamento per esercizio. `section`: un elemento di groupByMuscle. `favoriteSet`: gli id dei preferiti.
const MuscleGroupCard = ({ section, weightUnit, favoriteSet, onToggleFavorite }) => {
  const { t } = useTranslation();
  const id = `progress-group-${section.muscle}`;
  const label = section.muscle === 'other' ? t('progress.muscle_other') : muscleLabel(section.muscle);
  return (
    <Card component="section" aria-labelledby={id}>
      <Typography id={id} component="h2" variant="cardTitle" sx={{ px: 2.5, pt: 2, pb: 1 }}>
        {label} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 16 }}>· {t('progress.section_count', { count: section.items.length })}</Box>
      </Typography>
      <Box component="ul" sx={{ m: 0, px: { xs: 1, md: 1.5 }, pb: 1, listStyle: 'none' }}>
        {section.items.map((item) => (
          <ExerciseProgressRow
            key={item.id}
            item={item}
            weightUnit={weightUnit}
            favorite={favoriteSet.has(item.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </Box>
    </Card>
  );
};

export default MuscleGroupCard;

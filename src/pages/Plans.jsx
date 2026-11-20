import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import WorkoutPlans from './WorkoutPlans';

// Pagina «Schede» (/schede): il titolo e l'elenco delle schede di prima.
const Plans = () => {
  const { t } = useTranslation();
  usePageMeta(t('nav.plans'), t('plans.meta.description'));

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="pageTitle" gutterBottom>{t('nav.plans')}</Typography>
      <Box sx={{ mt: 2 }}>
        <WorkoutPlans isEmbedded />
      </Box>
    </Box>
  );
};

export default Plans;

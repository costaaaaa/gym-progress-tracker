import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import { useNavigationRequest } from '../hooks/useNavigationRequest';
import WorkoutHistory from './WorkoutHistory';

// Pagina «Storico» (/storico): il titolo e la cronologia degli allenamenti di prima.
// `refreshHistory` (stato di navigazione, a fine allenamento) rilegge l'elenco; `openRecord` (dal ventaglio)
// apre la finestra «Registra allenamento».
const History = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const recordRequest = useNavigationRequest('openRecord');
  usePageMeta(t('nav.history'), t('history.meta.description'));

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="pageTitle" gutterBottom>{t('nav.history')}</Typography>
      <Box sx={{ mt: 2 }}>
        <WorkoutHistory isEmbedded refreshKey={location.state?.refreshHistory} recordRequest={recordRequest} />
      </Box>
    </Box>
  );
};

export default History;

import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { radius } from '../../theme/radius';

// La pillola «Attiva» di una scheda, nell'elenco e nella sua pagina. `id` serve a chi la usa come nome accessibile.
const ActiveBadge = ({ id }) => {
  const { t } = useTranslation();
  return (
    <Box
      id={id}
      component="span"
      sx={{ display: 'inline-block', bgcolor: 'success.muted', color: 'success.title', fontSize: 13, fontWeight: 700, px: 1.25, py: 0.5, borderRadius: radius.pill }}
    >
      {t('plans.active_badge')}
    </Box>
  );
};

export default ActiveBadge;

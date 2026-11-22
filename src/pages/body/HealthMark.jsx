import { Box } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useTranslation } from 'react-i18next';

const HealthMark = () => {
  const { t } = useTranslation();
  return (
    <Box component="span" title={t('body.from_health')} sx={{ ml: 0.5, verticalAlign: 'middle' }}>
      <FavoriteIcon sx={{ fontSize: 11, color: 'health' }} />
    </Box>
  );
};

export default HealthMark;

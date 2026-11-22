import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FocusToolsOptions from '../../components/Focus/FocusToolsOptions';

// Strumenti del Focus: titolo e opzioni (che si salvano da sole); l'esito va a notify(message, severity).
const FocusToolsSetting = ({ notify }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('focus.tools.title')}</Typography>
      <FocusToolsOptions notify={notify} idPrefix="account-focus-tools" />
    </Box>
  );
};

export default FocusToolsSetting;

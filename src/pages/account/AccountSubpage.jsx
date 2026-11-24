import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';

// Scheletro delle cinque pagine sotto /account: «indietro» verso l'elenco, il titolo (che è anche il titolo del documento)
// e la colonna dei pezzi. La larghezza della colonna la dà la cornice (Account).
const AccountSubpage = ({ title, children }) => {
  const { t } = useTranslation();
  usePageMeta(title, t('account.meta.description'));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton component={RouterLink} to="/account" aria-label={t('account.back')} edge="start" sx={{ width: 44, height: 44, color: 'text.primary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0 }}>{title}</Typography>
      </Box>
      {children}
    </Box>
  );
};

export default AccountSubpage;

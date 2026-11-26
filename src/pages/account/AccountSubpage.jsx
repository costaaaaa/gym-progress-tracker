import { Box, Typography } from '@mui/material';
import BackArrow from '../../components/BackArrow';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';

// Scheletro delle pagine sotto /account: «indietro» verso l'elenco, il titolo (che è anche il titolo del documento)
// e la colonna dei pezzi. La larghezza della colonna la dà la cornice (Account).
const AccountSubpage = ({ title, children }) => {
  const { t } = useTranslation();
  usePageMeta(title, t('account.meta.description'));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BackArrow to="/account" label={t('account.back')} />
        <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0 }}>{title}</Typography>
      </Box>
      {children}
    </Box>
  );
};

export default AccountSubpage;

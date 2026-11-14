import { Lock as LockIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Lucchetto dei comandi riservati a Premium, con la parola accanto: stesso colore, testo piccolo.
const PremiumLock = () => {
  const { t } = useTranslation();
  return (
    <>
      <LockIcon sx={{ fontSize: '16px !important' }} />
      <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2 }}>{t('common.premium')}</span>
    </>
  );
};

export default PremiumLock;

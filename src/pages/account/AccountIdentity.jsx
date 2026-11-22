import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

// Nome utente ed email dell'account, con i ripieghi quando mancano: l'indirizzo è quello dello stato dell'email se c'è.
// Sta nella testata dell'elenco e nella card del profilo.
const AccountIdentity = ({ account }) => {
  const { t } = useTranslation();
  const { emailState } = useAuth();

  return (
    <>
      <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
        {account?.username || t('account.user_fallback')}
      </Typography>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', overflowWrap: 'anywhere' }}>
        {emailState?.email || account?.email || t('account.email_unavailable')}
      </Typography>
    </>
  );
};

export default AccountIdentity;

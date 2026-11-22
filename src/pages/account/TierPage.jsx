import { Card } from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountTier from '../../components/Account/AccountTier';
import AccountSubpage from './AccountSubpage';

// Pagina «Piano» (/account/piano): il piano attuale con i suoi stati (scadenza, codice in attesa, codice non applicato)
// e il collegamento alla pagina dei piani. Senza il campo del livello (server più vecchio) non c'è nulla da mostrare.
const TierPage = () => {
  const { t } = useTranslation();
  const { account } = useOutletContext();

  return (
    <AccountSubpage title={t('account.section.tier.title')}>
      {account?.tier && (
        <Card sx={{ p: '24px' }}>
          <AccountTier tier={account.tier} lastDay={account.tier_last_day} signupCode={account.signup_code} />
        </Card>
      )}
    </AccountSubpage>
  );
};

export default TierPage;

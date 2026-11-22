import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountSubpage from './AccountSubpage';
import PasswordCard from './PasswordCard';

// Pagina «Sicurezza» (/account/sicurezza): il cambio password.
const SecurityPage = () => {
  const { t } = useTranslation();
  const { account, notify } = useOutletContext();

  return (
    <AccountSubpage title={t('account.section.security.title')}>
      <PasswordCard account={account} notify={notify} />
    </AccountSubpage>
  );
};

export default SecurityPage;

import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ModulesCard from '../../components/Account/ModulesCard';
import AccountSubpage from './AccountSubpage';

// Pagina «Moduli» (/account/moduli): cosa vedere in LiftIndex.
const ModulesPage = () => {
  const { t } = useTranslation();
  const { notify } = useOutletContext();

  return (
    <AccountSubpage title={t('modules.title')}>
      <ModulesCard notify={notify} />
    </AccountSubpage>
  );
};

export default ModulesPage;

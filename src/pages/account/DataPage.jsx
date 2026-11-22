import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GroupsVisibilityCard from '../../components/Groups/GroupsVisibilityCard';
import AccountSubpage from './AccountSubpage';
import ConsentCard from './ConsentCard';
import ExportCard from './ExportCard';

// Pagina «Dati e privacy» (/account/dati): consenso alle misure, gruppi mostrati e visibilità, esportazione. Le ancore
// #groups-shown e #groups-list (collegamenti dai Gruppi e dai Moduli) arrivano qui.
const DataPage = () => {
  const { t } = useTranslation();
  const { account, notify } = useOutletContext();

  return (
    <AccountSubpage title={t('account.section.data.title')}>
      <ConsentCard username={account?.username} notify={notify} />
      <GroupsVisibilityCard notify={notify} />
      <ExportCard username={account?.username} notify={notify} />
    </AccountSubpage>
  );
};

export default DataPage;

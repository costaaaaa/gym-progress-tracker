import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountSubpage from './AccountSubpage';
import ProfileCard from './ProfileCard';
import PreferenceGroups from './PreferenceGroups';
import YouGroup from './YouGroup';
import useRowDialog from './useRowDialog';

// Pagina «Profilo e preferenze» (/account/profilo): nome ed email col suo stato, poi i gruppi «Tu», «Allenamento» e «App»
// con una riga per impostazione. Una sola finestra è aperta alla volta: `useRowDialog` è di tutti i gruppi.
const ProfilePage = () => {
  const { t } = useTranslation();
  const { account, joinDate, notify, patchAccount } = useOutletContext();
  const dialog = useRowDialog();

  return (
    <AccountSubpage title={t('account.section.profile_prefs.title')}>
      <ProfileCard account={account} joinDate={joinDate} notify={notify} />
      <YouGroup account={account} patchAccount={patchAccount} notify={notify} dialog={dialog} />
      <PreferenceGroups account={account} patchAccount={patchAccount} notify={notify} dialog={dialog} />
    </AccountSubpage>
  );
};

export default ProfilePage;

import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountSubpage from './AccountSubpage';
import PreferenceGroups from './PreferenceGroups';
import YouGroup from './YouGroup';
import useRowDialog from './useRowDialog';

// Pagina «Profilo e preferenze» (/account/profilo): i gruppi «Tu», «Allenamento» e «App», con una riga per impostazione.
// Nome ed email con l'avatar stanno già nella testata dell'elenco dell'Account. Una sola finestra è aperta alla volta:
// `useRowDialog` è di tutti i gruppi e porta l'avviso dopo un salvataggio (`notify` della cornice).
const ProfilePage = () => {
  const { t } = useTranslation();
  const { account, joinDate, notify, patchAccount } = useOutletContext();
  const dialog = useRowDialog(notify);

  return (
    <AccountSubpage title={t('account.section.profile_prefs.title')}>
      <YouGroup account={account} joinDate={joinDate} patchAccount={patchAccount} dialog={dialog} />
      <PreferenceGroups account={account} patchAccount={patchAccount} dialog={dialog} />
    </AccountSubpage>
  );
};

export default ProfilePage;

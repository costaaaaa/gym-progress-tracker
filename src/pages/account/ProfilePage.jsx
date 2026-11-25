import { Card } from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountSubpage from './AccountSubpage';
import ProfileCard from './ProfileCard';
import PhysicalProfileForm from './PhysicalProfileForm';
import PreferenceGroups from './PreferenceGroups';

// Pagina «Profilo e preferenze» (/account/profilo): nome ed email col suo stato, profilo fisico, poi i gruppi
// «Allenamento» e «App» con una riga per impostazione.
const ProfilePage = () => {
  const { t } = useTranslation();
  const { account, joinDate, notify, patchAccount } = useOutletContext();

  return (
    <AccountSubpage title={t('account.section.profile_prefs.title')}>
      <ProfileCard account={account} joinDate={joinDate} notify={notify} />
      <Card sx={{ p: '24px' }}>
        <PhysicalProfileForm account={account} notify={notify} />
      </Card>
      <PreferenceGroups account={account} patchAccount={patchAccount} notify={notify} />
    </AccountSubpage>
  );
};

export default ProfilePage;

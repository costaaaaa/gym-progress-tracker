import { Card } from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountSubpage from './AccountSubpage';
import ProfileCard from './ProfileCard';
import PhysicalProfileForm from './PhysicalProfileForm';
import WeightUnitSetting from './WeightUnitSetting';

// Pagina «Profilo» (/account/profilo): nome ed email col suo stato, profilo fisico, unità di misura.
const ProfilePage = () => {
  const { t } = useTranslation();
  const { account, joinDate, notify } = useOutletContext();

  return (
    <AccountSubpage title={t('account.section.profile.title')}>
      <ProfileCard account={account} joinDate={joinDate} notify={notify} />
      <Card sx={{ p: '24px' }}>
        <PhysicalProfileForm account={account} notify={notify} />
      </Card>
      <Card sx={{ p: '24px' }}>
        <WeightUnitSetting account={account} notify={notify} first />
      </Card>
    </AccountSubpage>
  );
};

export default ProfilePage;

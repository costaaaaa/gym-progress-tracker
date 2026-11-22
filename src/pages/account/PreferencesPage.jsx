import { Card } from '@mui/material';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AccountSubpage from './AccountSubpage';
import LanguageSetting from './LanguageSetting';
import WeeklyGoalSetting from './WeeklyGoalSetting';
import FocusToolsSetting from './FocusToolsSetting';

// Pagina «Preferenze» (/account/preferenze): lingua, obiettivo settimanale e strumenti della serie, in una card e
// separati da una linea (la linea sta sopra ogni impostazione, tranne la prima).
const PreferencesPage = () => {
  const { t } = useTranslation();
  const { account, notify } = useOutletContext();

  return (
    <AccountSubpage title={t('account.section.preferences.title')}>
      <Card sx={{ p: '24px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <LanguageSetting account={account} notify={notify} />
        <WeeklyGoalSetting account={account} notify={notify} />
        <FocusToolsSetting notify={notify} />
      </Card>
    </AccountSubpage>
  );
};

export default PreferencesPage;

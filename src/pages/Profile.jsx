import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { INK_TABS } from '../utils/inkTabs';
import { Box, Tabs, Tab, CircularProgress, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTabbedPage } from '../hooks/useTabbedPage';

// Lazy loading dei componenti tab
const ProfileSummary = lazy(() => import('./ProfileSummary'));
const Account = lazy(() => import('./Account'));

const TABS = [
  { id: 'summary', label: 'profile.tab_summary' },
  { id: 'settings', label: 'profile.tab_settings' },
];

const Profile = () => {
  const { t } = useTranslation();
  const { currentTab, tabIndex, handleTabChange, visitedTabs } = useTabbedPage(TABS, 'profile');

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="pageTitle" gutterBottom>{t('profile.title')}</Typography>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label={t('profile.tabs_aria')}
          {...INK_TABS}
        >
          <Tab
            icon={<EmojiEventsIcon fontSize="small" />}
            iconPosition="start"
            label={t('profile.tab_summary')}
            id="profile-tab-0"
          />
          <Tab
            icon={<SettingsIcon fontSize="small" />}
            iconPosition="start"
            label={t('profile.tab_settings')}
            id="profile-tab-1"
          />
        </Tabs>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Suspense fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        }>
          {/* Usiamo display: none per mantenere montati i componenti ma nasconderli */}
          {visitedTabs.summary && (
            <Box sx={{ display: currentTab === 'summary' ? 'block' : 'none' }}>
              <ProfileSummary />
            </Box>
          )}
          {visitedTabs.settings && (
            <Box sx={{ display: currentTab === 'settings' ? 'block' : 'none' }}>
              <Account isEmbedded={true} />
            </Box>
          )}
        </Suspense>
      </Box>
    </Box>
  );
};

export default Profile;

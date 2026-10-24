import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tabs, Tab, CircularProgress, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SettingsIcon from '@mui/icons-material/Settings';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTabbedPage } from '../hooks/useTabbedPage';

// Lazy loading dei componenti tab
const ProfileSummary = lazy(() => import('./ProfileSummary'));
const Account = lazy(() => import('./Account'));

const TABS = ['summary', 'settings'];

const Profile = () => {
  const { t } = useTranslation();
  usePageMeta(t('profile.meta.title'), t('profile.meta.description'));
  const { currentTab, tabIndex, handleTabChange, visitedTabs } = useTabbedPage(TABS);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="pageTitle" gutterBottom>{t('profile.title')}</Typography>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="profile hub tabs"
          TabIndicatorProps={{ sx: { height: 2, bgcolor: 'text.primary' } }}
          sx={{
            minHeight: 0,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 500,
              minHeight: 44,
              color: 'text.secondary',
              '&.Mui-selected': { color: 'text.primary', fontWeight: 600 },
              '& .MuiTab-iconWrapper': { color: 'text.secondary' },
            },
          }}
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

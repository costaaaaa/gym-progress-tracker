import { Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SettingsIcon from '@mui/icons-material/Settings';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTabbedPage } from '../hooks/useTabbedPage';

// Lazy loading dei componenti tab
const ProfileSummary = lazy(() => import('./ProfileSummary'));
const Account = lazy(() => import('./Account'));

const TABS = ['summary', 'settings'];

const Profile = () => {
  usePageMeta(
    'Profilo e Impostazioni',
    'Gestisci il tuo profilo, i traguardi raggiunti e le impostazioni del tuo account LiftIndex.'
  );
  const { currentTab, tabIndex, handleTabChange, visitedTabs } = useTabbedPage(TABS);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="profile hub tabs"
          TabIndicatorProps={{ sx: { height: 2, bgcolor: 'primary.main' } }}
          sx={{
            minHeight: 0,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 500,
              minHeight: 44,
              color: 'text.secondary',
              '&.Mui-selected': { color: 'primary.main', fontWeight: 600 },
            },
          }}
        >
          <Tab
            icon={<EmojiEventsIcon fontSize="small" />}
            iconPosition="start"
            label="Riepilogo"
            id="profile-tab-0"
          />
          <Tab
            icon={<SettingsIcon fontSize="small" />}
            iconPosition="start"
            label="Impostazioni"
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

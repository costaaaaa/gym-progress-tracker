import { useState, useEffect, Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SettingsIcon from '@mui/icons-material/Settings';
import { usePageMeta } from '../hooks/usePageMeta';

// Lazy loading dei componenti tab
const ProfileSummary = lazy(() => import('./ProfileSummary'));
const Account = lazy(() => import('./Account'));

// Statiche: nessun riferimento a stato/props, per questo vivono fuori dal
// componente. Ricrearle a ogni render romperebbe react-hooks/exhaustive-deps
// (nuova identità a ogni render -> se incluse nelle dipendenze degli effetti
// sotto, li farebbero rieseguire a ogni render, non solo al cambio di tab).
const tabToIndex = {
  'summary': 0,
  'settings': 1
};

const indexToTab = {
  0: 'summary',
  1: 'settings'
};

const Profile = () => {
  usePageMeta(
    'Profilo e Impostazioni',
    'Gestisci il tuo profilo, i traguardi raggiunti e le impostazioni del tuo account Gym Progress Tracker.'
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'summary';
  const [visitedTabs, setVisitedTabs] = useState(() => ({
    summary: currentTab === 'summary',
    settings: currentTab === 'settings'
  }));

  const handleTabChange = (event, newValue) => {
    setSearchParams({ tab: indexToTab[newValue] });
  };

  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(tabToIndex, currentTab)) {
      setVisitedTabs(prev => ({
        ...prev,
        [currentTab]: true
      }));
    }
  }, [currentTab]);

  // Reset dello scroll al cambio tab
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentTab]);

  // Normalizzazione URL se il tab non è valido
  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(tabToIndex, currentTab)) {
      setSearchParams({ tab: 'summary' }, { replace: true });
    }
  }, [currentTab, setSearchParams]);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tabToIndex[currentTab] || 0}
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

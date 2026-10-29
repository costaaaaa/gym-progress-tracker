import { Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import StraightenIcon from '@mui/icons-material/Straighten';
import StackedBarChartIcon from '@mui/icons-material/StackedBarChart';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import PrototypeSwitcher, { useVariant } from '../components/PrototypeSwitcher';
import VolumeView, { VARIANT_NAMES } from './prototypeVolume/VolumeVariants';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTabbedPage } from '../hooks/useTabbedPage';
import { useTranslation } from 'react-i18next';
import { INK_TABS } from '../utils/inkTabs';

// Lazy loading dei componenti tab
const Progress = lazy(() => import('./Progress'));
const BodyStats = lazy(() => import('./BodyStats'));

// PROTOTIPO giro 2: P1 scheda "Volume" · P2 scheda "Muscoli" (serie + recupero) · P3 sezione in cima a Progressi
const TABS_BY_VARIANT = {
  P1: ['progress', 'volume', 'body'],
  P2: ['progress', 'muscles', 'body'],
  P3: ['progress', 'body'],
};
const MIDDLE = { volume: { label: 'Volume', icon: <StackedBarChartIcon fontSize="small" /> }, muscles: { label: 'Muscoli', icon: <AccessibilityNewIcon fontSize="small" /> } };

const Dashboard = () => {
  const { t } = useTranslation();
  usePageMeta(t('dashboard.meta.title'), t('dashboard.meta.description'));
  const variant = useVariant(['P1', 'P2', 'P3']);
  const tabs = TABS_BY_VARIANT[variant];
  const middle = tabs.length === 3 ? tabs[1] : null;
  // con tre schede servono etichette corte, altrimenti a 390 px vanno a capo
  const short = middle !== null;
  const { currentTab, tabIndex, handleTabChange, visitedTabs } = useTabbedPage(tabs);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="pageTitle" gutterBottom>{t('dashboard.title')}</Typography>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="dashboard hub tabs"
          {...INK_TABS}
        >
          <Tab
            icon={<BarChartIcon fontSize="small" />}
            iconPosition="start"
            label={short ? 'Esercizi' : t('dashboard.tab.progress')}
            id="dashboard-tab-0"
          />
          {middle && (
            <Tab
              icon={MIDDLE[middle].icon}
              iconPosition="start"
              label={MIDDLE[middle].label}
              id="dashboard-tab-middle"
            />
          )}
          <Tab
            icon={<StraightenIcon fontSize="small" />}
            iconPosition="start"
            label={short ? 'Misure' : t('dashboard.tab.body')}
            id="dashboard-tab-1"
          />
        </Tabs>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Suspense fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        }>
          {visitedTabs.progress && (
            <Box sx={{ display: currentTab === 'progress' ? 'block' : 'none' }}>
              {variant === 'P3' && <Box sx={{ mb: 3 }}><VolumeView kind="volume" /></Box>}
              <Progress isEmbedded={true} />
            </Box>
          )}
          {middle && visitedTabs[middle] && (
            <Box sx={{ display: currentTab === middle ? 'block' : 'none' }}>
              <VolumeView kind={middle} />
            </Box>
          )}
          {visitedTabs.body && (
            <Box sx={{ display: currentTab === 'body' ? 'block' : 'none' }}>
              <BodyStats isEmbedded={true} />
            </Box>
          )}
        </Suspense>
      </Box>
      <PrototypeSwitcher variants={['P1', 'P2', 'P3']} names={VARIANT_NAMES} />
    </Box>
  );
};

export default Dashboard;

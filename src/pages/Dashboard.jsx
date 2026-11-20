import { Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useTabbedPage } from '../hooks/useTabbedPage';
import { useModule } from '../hooks/useModule';
import { ModuleInactive } from '../components/ModuleGate';
import { useTranslation } from 'react-i18next';
import { INK_TABS } from '../utils/inkTabs';

// Lazy loading dei componenti tab
const Progress = lazy(() => import('./Progress'));
const Muscles = lazy(() => import('./Muscles'));
const BodyStats = lazy(() => import('./BodyStats'));

// `module`: il modulo facoltativo di cui la tab fa parte (Esercizi è sempre visibile)
const TABS = [
  { id: 'progress', label: 'dashboard.tab.progress' },
  { id: 'muscles', label: 'dashboard.tab.muscles', module: 'recovery' },
  { id: 'body', label: 'dashboard.tab.body', module: 'body' },
];

const TAB_ICONS = {
  progress: <BarChartIcon fontSize="small" />,
  muscles: <AccessibilityNewIcon fontSize="small" />,
  body: <StraightenIcon fontSize="small" />,
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { currentTab, visitedTabs, handleTabChange } = useTabbedPage(TABS, { title: t('dashboard.title'), description: t('dashboard.meta.description') });
  const modules = { recovery: useModule('recovery'), body: useModule('body') };
  // Una tab di un modulo non attivo sparisce dalla riga; se l'indirizzo la chiede, al suo posto c'è la pagina «non attivo»
  const visibleTabs = TABS.filter((tab) => !tab.module || modules[tab.module]);
  const requested = TABS.find((tab) => tab.id === currentTab);
  const inactive = requested?.module && !modules[requested.module] ? requested : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="pageTitle" gutterBottom>{t('dashboard.title')}</Typography>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={inactive ? false : Math.max(visibleTabs.findIndex((tab) => tab.id === currentTab), 0)}
          onChange={(event, index) => handleTabChange(event, TABS.indexOf(visibleTabs[index]))}
          aria-label={t('dashboard.tabs_aria')}
          {...INK_TABS}
        >
          {visibleTabs.map((tab) => (
            <Tab
              key={tab.id}
              icon={TAB_ICONS[tab.id]}
              iconPosition="start"
              label={t(tab.label)}
              id={`dashboard-tab-${TABS.indexOf(tab)}`}
            />
          ))}
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
              <Progress isEmbedded={true} />
            </Box>
          )}
          {inactive && <ModuleInactive module={inactive.module} heading="h2" />}
          {visitedTabs.muscles && modules.recovery && (
            <Box sx={{ display: currentTab === 'muscles' ? 'block' : 'none' }}>
              <Muscles />
            </Box>
          )}
          {visitedTabs.body && modules.body && (
            <Box sx={{ display: currentTab === 'body' ? 'block' : 'none' }}>
              <BodyStats isEmbedded={true} />
            </Box>
          )}
        </Suspense>
      </Box>
    </Box>
  );
};

export default Dashboard;

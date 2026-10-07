import { Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import StraightenIcon from '@mui/icons-material/Straighten';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTabbedPage } from '../hooks/useTabbedPage';

// Lazy loading dei componenti tab
const Progress = lazy(() => import('./Progress'));
const BodyStats = lazy(() => import('./BodyStats'));

const TABS = ['progress', 'body'];

const Dashboard = () => {
  usePageMeta(
    'Dashboard Progressi',
    'Monitora i tuoi progressi in palestra: grafici sui carichi, statistiche corporee e andamento nel tempo per ogni esercizio.'
  );
  const { currentTab, tabIndex, handleTabChange, visitedTabs } = useTabbedPage(TABS);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="dashboard hub tabs"
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
            icon={<BarChartIcon fontSize="small" />}
            iconPosition="start"
            label="Progressi Workout"
            id="dashboard-tab-0"
          />
          <Tab
            icon={<StraightenIcon fontSize="small" />}
            iconPosition="start"
            label="Misure Corporee"
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
              <Progress isEmbedded={true} />
            </Box>
          )}
          {visitedTabs.body && (
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

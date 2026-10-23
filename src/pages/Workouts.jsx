import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tabs, Tab, CircularProgress, Container, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTabbedPage } from '../hooks/useTabbedPage';

// Lazy loading dei componenti tab
const WorkoutPlans = lazy(() => import('./WorkoutPlans'));
const WorkoutHistory = lazy(() => import('./WorkoutHistory'));

const TABS = ['plans', 'history'];

const Workouts = () => {
  const { t } = useTranslation();
  usePageMeta(t('workouts.meta.title'), t('workouts.meta.description'));
  const location = useLocation();
  const { currentTab, tabIndex, handleTabChange, visitedTabs } = useTabbedPage(TABS);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ width: '100%' }}>
        <Typography variant="pageTitle" gutterBottom>
          {t('workouts.title')}
        </Typography>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="workout hub tabs"
            TabIndicatorProps={{ sx: { height: 2, bgcolor: 'text.primary' } }}
            sx={{
              minHeight: 0,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 500,
                minHeight: 44,
                color: 'text.secondary',
                '&.Mui-selected': { color: 'text.primary', fontWeight: 600 },
                '& .MuiTab-iconWrapper': { color: 'text.secondary' },
              },
            }}
          >
            <Tab
              icon={<FitnessCenterIcon fontSize="small" />}
              iconPosition="start"
              label={t('workouts.tab_plans')}
              id="workout-tab-0"
            />
            <Tab
              icon={<CalendarTodayIcon fontSize="small" />}
              iconPosition="start"
              label={t('workouts.tab_history')}
              id="workout-tab-1"
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
            {visitedTabs.plans && (
              <Box sx={{ display: currentTab === 'plans' ? 'block' : 'none' }}>
                <WorkoutPlans isEmbedded={true} />
              </Box>
            )}
            {visitedTabs.history && (
              <Box sx={{ display: currentTab === 'history' ? 'block' : 'none' }}>
                <WorkoutHistory isEmbedded={true} refreshKey={location.state?.refreshHistory} />
              </Box>
            )}
          </Suspense>
        </Box>
      </Box>
    </Container>
  );
};

export default Workouts;

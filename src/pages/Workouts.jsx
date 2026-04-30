import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress, Container } from '@mui/material';
import { useLocation, useSearchParams } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

// Lazy loading dei componenti tab
const WorkoutPlans = lazy(() => import('./WorkoutPlans'));
const WorkoutHistory = lazy(() => import('./WorkoutHistory'));

const Workouts = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'plans';
  const [visitedTabs, setVisitedTabs] = useState(() => ({
    plans: currentTab === 'plans',
    history: currentTab === 'history'
  }));
  
  // Mappa dei tab a indici numerici per MUI Tabs
  const tabToIndex = {
    'plans': 0,
    'history': 1
  };
  
  const indexToTab = {
    0: 'plans',
    1: 'history'
  };

  const handleTabChange = (event, newValue) => {
    setSearchParams({ tab: indexToTab[newValue] });
  };

  useEffect(() => {
    if (tabToIndex.hasOwnProperty(currentTab)) {
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
    if (!tabToIndex.hasOwnProperty(currentTab)) {
      setSearchParams({ tab: 'plans' }, { replace: true });
    }
  }, [currentTab, setSearchParams]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={tabToIndex[currentTab] || 0} 
            onChange={handleTabChange} 
            aria-label="workout hub tabs"
            variant="fullWidth"
          >
            <Tab 
              icon={<FitnessCenterIcon />} 
              iconPosition="start" 
              label="Le tue Schede" 
              id="workout-tab-0" 
            />
            <Tab 
              icon={<CalendarTodayIcon />} 
              iconPosition="start" 
              label="Cronologia" 
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

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Box, Tabs, Tab, CircularProgress, Container } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import BarChartIcon from '@mui/icons-material/BarChart';
import StraightenIcon from '@mui/icons-material/Straighten';

// Lazy loading dei componenti tab
const Progress = lazy(() => import('./Progress'));
const BodyStats = lazy(() => import('./BodyStats'));

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'progress';
  const [visitedTabs, setVisitedTabs] = useState(() => ({
    progress: currentTab === 'progress',
    body: currentTab === 'body'
  }));
  
  const tabToIndex = {
    'progress': 0,
    'body': 1
  };
  
  const indexToTab = {
    0: 'progress',
    1: 'body'
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

  useEffect(() => {
    if (!tabToIndex.hasOwnProperty(currentTab)) {
      setSearchParams({ tab: 'progress' }, { replace: true });
    }
  }, [currentTab, setSearchParams]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={tabToIndex[currentTab] || 0} 
            onChange={handleTabChange} 
            aria-label="dashboard hub tabs"
            variant="fullWidth"
          >
            <Tab 
              icon={<BarChartIcon />} 
              iconPosition="start" 
              label="Progressi Workout" 
              id="dashboard-tab-0" 
            />
            <Tab 
              icon={<StraightenIcon />} 
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
    </Container>
  );
};

export default Dashboard;

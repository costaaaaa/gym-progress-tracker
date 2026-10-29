import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Typography, Grid, Button, Box, Alert, Snackbar, CircularProgress, Card, CardActionArea } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StraightenOutlined from '@mui/icons-material/StraightenOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import HealthAndSafetyOutlined from '@mui/icons-material/HealthAndSafetyOutlined';
import BodyVisualizer from '../components/BodyVisualizer';
import StreakCard from '../components/StreakCard';
import LevelCard from '../components/LevelCard';
import GroupsHomeCard from '../components/Groups/GroupsHomeCard';
import { useAuth } from '../context/AuthContext';
import { CHIP_FONT, TITLE_FONT_FAMILY } from '../utils/fonts';
import { API_BASE_URL } from '../config';
import { useTranslation, Trans } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import { formatDate as formatLocalDate, formatNumber } from '../i18n/format';
import { totalSets } from '../utils/weeklySets';

// Landing per gli ospiti: carica GSAP solo per chi non ha fatto il login.
const Landing = lazy(() => import('./landing/Landing'));

// Pillola di Azioni Rapide: fondo bianco, bordo 1px, icona stroked grigia.
const QuickActionPill = ({ to, icon, label }) => (
  <Box
    component={RouterLink}
    to={to}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1,
      px: '20px',
      py: '11px',
      borderRadius: '999px',
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      textDecoration: 'none',
      color: 'text.primary',
      ...CHIP_FONT,
      fontSize: 13,
      transition: 'border-color .2s ease',
      '&:hover': { borderColor: 'text.primary' },
    }}
  >
    {React.cloneElement(icon, { sx: { fontSize: 18, color: 'text.secondary' } })}
    {label}
  </Box>
);

const Home = () => {
  const { isLoggedIn, user } = useAuth();
  const { t } = useTranslation();
  usePageMeta(null, t('meta.description'));
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [lastWorkout, setLastWorkout] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  // weekly_goal è l'obiettivo effettivo; plan_days_total resta per i server più vecchi
  const weeklyGoal = dashboardStats?.weekly_goal ?? dashboardStats?.plan_days_total;
  const weeklySets = totalSets(dashboardStats?.weekly_sets?.week);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardData();
    }
  }, [isLoggedIn]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch workout history for the last workout
      const historyResponse = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        credentials: 'include'
      });
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (historyData.records && historyData.records.length > 0) {
          setLastWorkout(historyData.records[0]);
        }
      }

      // Fetch plans for the active plan
      const plansResponse = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
        credentials: 'include'
      });
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        if (plansData.records) {
          const active = plansData.records.find(plan => plan.is_active);
          setActivePlan(active || null);
        }
      }

      // Fetch dashboard stats
      const statsResponse = await fetch(`${API_BASE_URL}api/workout_stats/dashboard.php`, {
        credentials: 'include'
      });
      if (statsResponse.ok) {
        const text = await statsResponse.text();
        try {
          const statsData = JSON.parse(text);
          if (statsData.success) {
            setDashboardStats(statsData);
          }
        } catch (parseError) {
          console.error('Failed to parse dashboard JSON. Response text:', text);
          throw parseError;
        }
      } else {
        console.error('Dashboard stats API returned error:', statsResponse.status);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) =>
    formatLocalDate(dateString, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (!isLoggedIn) {
    return (
      <Suspense fallback={null}>
        <Landing />
      </Suspense>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 1.5 }}>
          {t('home.hero.welcome', { username: user?.username || '' })}
        </Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 3, maxWidth: 560, lineHeight: 1.6 }}>
          {t('home.hero.sub_user')}
        </Typography>
        <Button
          variant="contained"
          component={RouterLink}
          to="/focus"
          startIcon={<PlayArrowIcon />}
          sx={{ borderRadius: '12px', px: 3, py: 1.25, fontWeight: 700 }}
        >
          {t('home.hero.start_workout')}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {loading ? (
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress color="primary" size={60} thickness={4} />
          </Grid>
        ) : (
          <>
            {/* Streak / Livello */}
            <Grid item xs={12} md={6}>
              <StreakCard />
            </Grid>
            <Grid item xs={12} md={6}>
              <LevelCard />
            </Grid>

            {/* Riepilogo Settimanale */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', p: '22px' }}>
                <Typography component="h2" variant="cardTitle" sx={{ mb: 2.5 }}>
                  {t('home.weekly.title')}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('home.weekly.done')}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {dashboardStats?.weekly_workouts || 0} / {weeklyGoal || '-'}
                  </Typography>
                </Box>
                <Box sx={{ height: 9, borderRadius: '5px', bgcolor: 'divider', overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%',
                      width: `${weeklyGoal ? Math.min(100, (dashboardStats.weekly_workouts / weeklyGoal) * 100) : 0}%`,
                      bgcolor: 'primary.main',
                      borderRadius: '5px',
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1, mb: 2.5 }}>
                  {dashboardStats?.weekly_workouts >= weeklyGoal
                    ? t('home.weekly.goal_reached')
                    : t('home.weekly.missing', { count: Math.max(0, (weeklyGoal || 0) - (dashboardStats?.weekly_workouts || 0)) })}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 22 }}>
                      {formatNumber(dashboardStats?.weekly_volume?.total_weight)}
                      <Box component="span" sx={{ fontSize: 13, fontWeight: 600, ml: 0.5 }}>kg</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('home.weekly.volume')}</Typography>
                  </Box>
                  <CardActionArea
                    component={RouterLink}
                    to="/dashboard?tab=muscles"
                    sx={{ flex: 1, borderRadius: 1, mx: -1, px: 1, width: 'auto' }}
                  >
                    <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 22 }}>
                      {formatNumber(weeklySets)}
                      <Box component="span" sx={{ fontSize: 15, fontWeight: 600, ml: 0.5, color: 'primary.main' }}>›</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('home.weekly.sets')}</Typography>
                  </CardActionArea>
                </Box>
              </Card>
            </Grid>

            {/* Stato Muscolare */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', p: '22px' }}>
                <BodyVisualizer recoveryData={dashboardStats?.recovery} />
                <Button component={RouterLink} to="/dashboard?tab=muscles" size="small" sx={{ mt: 1.5, px: 0 }}>
                  {t('home.recovery_link')}
                </Button>
              </Card>
            </Grid>

            {/* Gruppi */}
            <Grid item xs={12} md={6}>
              <GroupsHomeCard />
            </Grid>

            {/* Ultimo Allenamento */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to="/workouts?tab=history" sx={{ height: '100%', p: '26px' }}>
                  <Typography component="h2" variant="cardTitle" sx={{ mb: 2.5 }}>{t('home.last.title')}</Typography>
                  {lastWorkout ? (
                    <>
                      <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: 15, mb: 1 }}>
                        {formatDate(lastWorkout.date)}
                      </Typography>
                      <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
                        <Trans i18nKey="home.last.done" values={{ count: lastWorkout.exercises?.length || 0 }} components={{ b: <strong /> }} />
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        {lastWorkout.exercises?.slice(0, 3).map((ex, i) => (
                          <Box
                            key={i}
                            sx={{ px: 1.5, py: 0.6, borderRadius: '8px', border: '1px solid', borderColor: 'divider', fontSize: 12, fontWeight: 600 }}
                          >
                            {ex.name}
                          </Box>
                        ))}
                        {lastWorkout.exercises?.length > 3 && (
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                            {t('home.last.more', { count: lastWorkout.exercises.length - 3 })}
                          </Typography>
                        )}
                      </Box>
                    </>
                  ) : (
                    <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{t('home.last.none')}</Typography>
                  )}
                </CardActionArea>
              </Card>
            </Grid>

            {/* Piano Attivo */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to="/workouts?tab=plans" sx={{ height: '100%', p: '26px' }}>
                  <Typography component="h2" variant="cardTitle" sx={{ mb: 2.5 }}>{t('home.plan.title')}</Typography>
                  {activePlan ? (
                    <>
                      <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: 15, mb: 1 }}>
                        {activePlan.name}
                      </Typography>
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontSize: 14,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.5,
                        }}
                      >
                        {activePlan.description || t('home.plan.no_description')}
                      </Typography>
                    </>
                  ) : (
                    <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{t('home.plan.none')}</Typography>
                  )}
                </CardActionArea>
              </Card>
            </Grid>

            {/* Azioni Rapide */}
            <Grid item xs={12}>
              <Typography variant="cardTitle" sx={{ mb: 2, mt: 2 }}>
                {t('home.quick.title')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <QuickActionPill to="/dashboard?tab=progress" icon={<AssessmentOutlined />} label={t('home.quick.progress')} />
                <QuickActionPill to="/dashboard?tab=body" icon={<StraightenOutlined />} label={t('home.quick.measures')} />
                <QuickActionPill to="/workouts?tab=history" icon={<CalendarTodayOutlined />} label={t('home.quick.history')} />
                <QuickActionPill to="/profilo?tab=settings" icon={<HealthAndSafetyOutlined />} label={t('home.quick.settings')} />
              </Box>
            </Grid>
          </>
        )}
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Home;

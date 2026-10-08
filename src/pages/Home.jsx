import React, { useState, useEffect } from 'react';
import { Typography, Paper, Grid, Button, Box, Divider, Alert, Snackbar, CircularProgress, Card, CardActionArea, Chip, Tooltip } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StraightenOutlined from '@mui/icons-material/StraightenOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import HealthAndSafetyOutlined from '@mui/icons-material/HealthAndSafetyOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import TimerIcon from '@mui/icons-material/Timer';
import StarIcon from '@mui/icons-material/Star';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import BodyVisualizer from '../components/BodyVisualizer';
import StreakCard from '../components/StreakCard';
import LevelCard from '../components/LevelCard';
import GroupsHomeCard from '../components/Groups/GroupsHomeCard';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { track } from '../utils/analytics';
import { useTranslation, Trans } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import { useLocalizedPath } from '../i18n/paths';
import { formatDate as formatLocalDate, formatNumber } from '../i18n/format';

// Dati di esempio per mostrare le card reali (Livello, Streak, Recupero) anche a chi
// non ha ancora effettuato l'accesso — stessa UI usata dagli utenti loggati, dati statici.
const PREVIEW_LEVEL = { level: 12, xp_into_level: 340, xp_for_next_level: 500, total_xp: 15420 };
const PREVIEW_STREAK = {
  current_streak_weeks: 6,
  longest_streak_weeks: 9,
  this_week: { count: 3, goal: 4, completed: false },
};
const PREVIEW_RECOVERY = {
  petto: { status: 'AFFATICATO' },
  schiena: { status: 'PRONTO' },
  spalle: { status: 'IN RECUPERO' },
  bicipiti: { status: 'PRONTO' },
  tricipiti: { status: 'IN RECUPERO' },
  addome: { status: 'PRONTO' },
  quadricipiti: { status: 'AFFATICATO' },
  femorali: { status: 'IN RECUPERO' },
  glutei: { status: 'PRONTO' },
  polpacci: { status: 'PRONTO' },
};
const PREVIEW_ACHIEVEMENTS = [
  { key: 'a1', label: 'home.ach.workouts_50', locked: false },
  { key: 'a2', label: 'home.ach.tons_10', locked: false },
  { key: 'a3', label: 'home.ach.streak_8', locked: true, threshold: ['home.ach.threshold_weeks', 8] },
  { key: 'a4', label: 'home.ach.workouts_100', locked: true, threshold: ['home.ach.threshold_sessions', 100] },
];

// Etichetta "Anteprima" sovrapposta alle card demo della landing: le rende inequivocabilmente
// non interattive/non reali, senza dover toccare lo stile delle card che avvolge.
const PreviewOverlay = ({ children }) => {
  const { t } = useTranslation();
  return (
  <Box sx={{ position: 'relative', height: '100%' }}>
    {children}
    <Chip
      icon={<VisibilityOutlined sx={{ fontSize: '14px !important' }} />}
      label={t('home.preview.badge')}
      size="small"
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        pointerEvents: 'none',
        bgcolor: (theme) => (theme.palette.mode === 'light' ? 'rgba(255,255,255,.92)' : 'rgba(30,30,30,.85)'),
        border: '1px solid',
        borderColor: 'divider',
        fontWeight: 700,
        fontSize: 11,
        color: 'text.secondary',
      }}
    />
  </Box>
  );
};

// Pillola di Azioni Rapide: fondo bianco, bordo 1px, icona stroked rossa.
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
      fontSize: 13,
      fontWeight: 600,
      transition: 'border-color .2s ease',
      '&:hover': { borderColor: 'primary.main' },
    }}
  >
    {React.cloneElement(icon, { sx: { fontSize: 18, color: 'primary.main' } })}
    {label}
  </Box>
);

const Home = () => {
  const { isLoggedIn, user } = useAuth();
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  usePageMeta(null, t('meta.description'));
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [lastWorkout, setLastWorkout] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
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

  return (
    <>
      <Box
        sx={{
          p: { xs: 4, md: '48px 44px' },
          mb: 4,
          borderRadius: '20px',
          textAlign: 'left',
          background: 'linear-gradient(135deg, #d50000 0%, #9b0000 100%)',
          color: '#fff',
        }}
      >
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 1.5, color: '#fff' }}
        >
          {isLoggedIn ? t('home.hero.welcome', { username: user?.username || '' }) : t('home.hero.title_guest')}
        </Typography>
        <Typography sx={{ fontSize: 16, color: 'rgba(255,255,255,.85)', mb: 3, maxWidth: 560, lineHeight: 1.6 }}>
          {isLoggedIn
            ? t('home.hero.sub_user')
            : t('home.hero.sub_guest')}
        </Typography>

        {isLoggedIn ? (
          <Button
            component={RouterLink}
            to="/focus"
            startIcon={<PlayArrowIcon />}
            sx={{
              bgcolor: '#fff',
              color: '#9b0000',
              borderRadius: '12px',
              px: 3,
              py: 1.25,
              fontWeight: 700,
              '&:hover': { bgcolor: 'rgba(255,255,255,.9)' },
            }}
          >
            {t('home.hero.start_workout')}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              component={RouterLink}
              to={localizedPath('/register')}
              onClick={() => track('landing_cta_click', { position: 'hero' })}
              sx={{
                bgcolor: '#fff',
                color: '#9b0000',
                borderRadius: '12px',
                px: 3,
                py: 1.25,
                fontWeight: 700,
                '&:hover': { bgcolor: 'rgba(255,255,255,.9)' },
              }}
            >
              {t('home.hero.cta')}
            </Button>
            <Button
              component={RouterLink}
              to={localizedPath('/login')}
              sx={{
                color: '#fff',
                border: '1px solid rgba(255,255,255,.6)',
                borderRadius: '12px',
                px: 3,
                py: 1.25,
                fontWeight: 700,
                '&:hover': { bgcolor: 'rgba(255,255,255,.1)', borderColor: '#fff' },
              }}
            >
              {t('home.hero.login')}
            </Button>
            <Typography sx={{ width: '100%', fontSize: 13, color: 'rgba(255,255,255,.8)' }}>
              {t('home.hero.note')}
            </Typography>
          </Box>
        )}
      </Box>

      {isLoggedIn ? (
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
                  <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2.5 }}>
                    {t('home.weekly.title')}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('home.weekly.done')}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                      {dashboardStats?.weekly_workouts || 0} / {dashboardStats?.plan_days_total || '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 9, borderRadius: '5px', bgcolor: 'divider', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${dashboardStats?.plan_days_total ? Math.min(100, (dashboardStats.weekly_workouts / dashboardStats.plan_days_total) * 100) : 0}%`,
                        background: 'linear-gradient(90deg, #d50000, #ff5131)',
                        borderRadius: '5px',
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1, mb: 2.5 }}>
                    {dashboardStats?.weekly_workouts >= dashboardStats?.plan_days_total
                      ? t('home.weekly.goal_reached')
                      : t('home.weekly.missing', { count: Math.max(0, (dashboardStats?.plan_days_total || 0) - (dashboardStats?.weekly_workouts || 0)) })}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box sx={{ flex: 1, p: 2, bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf5f5' : 'rgba(213, 0, 0, 0.08)', borderRadius: '10px', textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 22, color: 'primary.main' }}>
                        {formatNumber(dashboardStats?.weekly_volume?.total_weight)}
                        <Box component="span" sx={{ fontSize: 13, fontWeight: 600, ml: 0.5 }}>kg</Box>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('home.weekly.volume')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 2, bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf5f5' : 'rgba(213, 0, 0, 0.08)', borderRadius: '10px', textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 22, color: 'primary.main' }}>
                        {formatNumber(dashboardStats?.weekly_volume?.total_reps)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('home.weekly.reps')}</Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>

              {/* Stato Muscolare */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', p: '22px' }}>
                  <BodyVisualizer recoveryData={dashboardStats?.recovery} />
                </Card>
              </Grid>

              {/* Gruppi */}
              <Grid item xs={12} md={6}>
                <GroupsHomeCard />
              </Grid>

              {/* Ultimo Allenamento */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', borderLeft: '4px solid #d50000' }}>
                  <CardActionArea component={RouterLink} to="/workouts?tab=history" sx={{ height: '100%', p: '26px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: (theme) => theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                        <HistoryOutlined sx={{ color: 'primary.main', fontSize: 22 }} />
                      </Box>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>{t('home.last.title')}</Typography>
                    </Box>
                    {lastWorkout ? (
                      <>
                        <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: 15, mb: 1 }}>
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
                <Card sx={{ height: '100%', borderLeft: '4px solid #d50000' }}>
                  <CardActionArea component={RouterLink} to="/workouts?tab=plans" sx={{ height: '100%', p: '26px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: (theme) => theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                        <AssignmentOutlined sx={{ color: 'primary.main', fontSize: 22 }} />
                      </Box>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>{t('home.plan.title')}</Typography>
                    </Box>
                    {activePlan ? (
                      <>
                        <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: 15, mb: 1 }}>
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
                <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2, mt: 2 }}>
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
      ) : (
        <>
          {/* Come funziona: tre passi, per far capire il flusso prima delle card demo. */}
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2 }}>
            {t('home.how.title')}
          </Typography>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {[
              ['1', t('home.how.step1.title'), t('home.how.step1.text')],
              ['2', t('home.how.step2.title'), t('home.how.step2.text')],
              ['3', t('home.how.step3.title'), t('home.how.step3.text')],
            ].map(([n, title, text]) => (
              <Grid item xs={12} md={4} key={n}>
                <Card sx={{ p: '22px', height: '100%', '&:hover': { transform: 'none' } }}>
                  <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 28, color: 'primary.main', lineHeight: 1, mb: 1 }}>
                    {n}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>{title}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: 'text.secondary', lineHeight: 1.6 }}>{text}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Showcase: le stesse card che vede un utente loggato, con dati di esempio —
              stessa UI reale dell'app, nessuno screenshot statico da mantenere allineato.
              PreviewOverlay marca ogni card come non reale/non cliccabile, per non farla
              scambiare per i dati effettivi del visitatore. */}
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 0.5 }}>
            {t('home.showcase.title')}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            {t('home.showcase.subtitle')}
          </Typography>
          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <PreviewOverlay>
                <LevelCard previewData={PREVIEW_LEVEL} />
              </PreviewOverlay>
            </Grid>
            <Grid item xs={12} md={6}>
              <PreviewOverlay>
                <StreakCard previewData={PREVIEW_STREAK} />
              </PreviewOverlay>
            </Grid>

            <Grid item xs={12} md={6}>
              <PreviewOverlay>
                <Card sx={{ height: '100%', p: '22px', '&:hover': { transform: 'none' } }}>
                  <BodyVisualizer recoveryData={PREVIEW_RECOVERY} />
                </Card>
              </PreviewOverlay>
            </Grid>

            <Grid item xs={12} md={6}>
              <PreviewOverlay>
                <Card sx={{ height: '100%', p: '22px', '&:hover': { transform: 'none' } }}>
                  <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2 }}>
                    {t('home.achievements.title')}
                  </Typography>
                  <Grid container spacing={1.5}>
                    {PREVIEW_ACHIEVEMENTS.map((a) => (
                      <Grid item xs={6} key={a.key}>
                        <Tooltip title={a.locked ? t('home.ach.threshold', { value: t(a.threshold[0], { count: a.threshold[1] }) }) : t('home.ach.unlocked')} placement="top">
                          <Card
                            sx={{
                              borderRadius: '12px',
                              p: '16px 10px',
                              textAlign: 'center',
                              opacity: a.locked ? 0.5 : 1,
                              border: a.locked ? '1px solid' : '2px solid',
                              borderColor: a.locked ? 'divider' : 'primary.main',
                              cursor: 'default',
                              '&:hover': { transform: 'none' },
                            }}
                          >
                            {a.locked
                              ? <LockOutlinedIcon sx={{ fontSize: 24, color: 'text.disabled', mb: 0.75 }} />
                              : <StarIcon sx={{ fontSize: 24, color: 'primary.main', mb: 0.75 }} />}
                            <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                              {t(a.label)}
                            </Typography>
                          </Card>
                        </Tooltip>
                      </Grid>
                    ))}
                  </Grid>
                </Card>
              </PreviewOverlay>
            </Grid>
          </Grid>

          {/* Teaser Focus Mode: stessa palette del timer di recupero reale (anello rosso,
              font Lexend), senza replicare la logica del countdown effettivo. */}
          <Card sx={{ p: '26px', mb: 4, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', '&:hover': { transform: 'none' } }}>
            <Box
              sx={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                border: '5px solid',
                borderColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 20, color: 'primary.main' }}>
                01:30
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <TimerIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>
                  {t('home.focus.title')}
                </Typography>
              </Box>
              <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                {t('home.focus.text')}
              </Typography>
            </Box>
            <Chip label={t('home.focus.chip')} size="small" sx={{ fontWeight: 600 }} />
          </Card>

          {/* Riepilogo funzionalità aggiuntive, non coperte dallo showcase sopra.
              Apple Salute / Health Connect volutamente non elencata: vive nell'app mobile,
              da aggiungere quando l'app è sugli store. */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, height: '100%', borderTop: '4px solid #d50000' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LayersOutlined sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{t('home.feat.plans.title')}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('home.feat.plans.text')}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, height: '100%', borderTop: '4px solid #d50000' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <StraightenIcon sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{t('home.feat.measures.title')}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('home.feat.measures.text')}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, height: '100%', borderTop: '4px solid #d50000' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ShowChartOutlined sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{t('home.feat.charts.title')}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('home.feat.charts.text')}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 5, mb: 2 }}>
            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 20, mb: 2 }}>
              {t('home.footer.cta_title')}
            </Typography>
            <Button
              component={RouterLink}
              to={localizedPath('/register')}
              onClick={() => track('landing_cta_click', { position: 'footer' })}
              startIcon={<ShieldOutlined />}
              sx={{
                bgcolor: 'primary.main',
                color: '#fff',
                borderRadius: '12px',
                px: 4,
                py: 1.5,
                fontWeight: 700,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {t('home.footer.cta')}
            </Button>
          </Box>
        </>
      )}

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

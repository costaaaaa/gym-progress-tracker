import { Suspense, lazy, useState, useEffect } from 'react';
import { Grid, Button, Box, Skeleton, Card, Typography } from '@mui/material';
import { Link as RouterLink, useOutletContext } from 'react-router-dom';
import BodyVisualizer from '../components/BodyVisualizer';
import StreakCard from '../components/StreakCard';
import LevelCard from '../components/LevelCard';
import GroupsHomeCard from '../components/Groups/GroupsHomeCard';
import HomeOpening, { Greeting } from '../components/Home/HomeOpening';
import LastWorkout from '../components/Home/LastWorkout';
import { useAuth } from '../context/AuthContext';
import { isModuleActive } from '../hooks/useModule';
import { API_BASE_URL } from '../config';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../hooks/usePageMeta';
import { hasFocusSessionInProgress, savedDraftDayName } from '../utils/focusDraft';
import { homeState, isRedState, todayIndex } from '../utils/homeState';
import { radius } from '../theme/radius';

// Landing per gli ospiti: carica GSAP solo per chi non ha fatto il login.
const Landing = lazy(() => import('./landing/Landing'));

const NO_DAYS = new Array(7).fill(false);

// Risposta della richiesta come dati, o null se non è andata bene (lo stato di ogni richiesta lo decide il chiamante)
const fetchJson = async (path, accept = () => true) => {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!response.ok) return null;
  const data = await response.json();
  return accept(data) ? data : null;
};

const Home = () => {
  const { isLoggedIn, user, weightUnit } = useAuth();
  // Moduli facoltativi: ciò che non è attivo non si mostra (i dati restano)
  const levelsOn = isModuleActive(user, 'levels');
  const recoveryOn = isModuleActive(user, 'recovery');
  const groupsOn = isModuleActive(user, 'groups');
  const { t } = useTranslation();
  usePageMeta(null, t('meta.description'));
  // Stato di ogni richiesta: 'pending' | 'ok' | 'failed'. Un errore di rete non deve far passare un utente per nuovo
  const [historyStatus, setHistoryStatus] = useState('pending');
  const [plansStatus, setPlansStatus] = useState('pending');
  const [dashboardStatus, setDashboardStatus] = useState('pending');
  const [records, setRecords] = useState([]);
  const [hasPlans, setHasPlans] = useState(false);
  const [stats, setStats] = useState(null);
  // Il Layout colora la barra in alto di rosso (sul telefono) mentre l'apertura è rossa
  const { setBarRed } = useOutletContext() ?? {};

  useEffect(() => {
    if (!isLoggedIn) return;
    // Le tre richieste partono insieme, ognuna con il suo esito: una che fallisce non ferma le altre
    const load = async (path, accept, onData, setStatus) => {
      try {
        const data = await fetchJson(path, accept);
        if (data) onData(data);
        setStatus(data ? 'ok' : 'failed');
      } catch (error) {
        console.error(`Errore nel caricamento di ${path}:`, error);
        setStatus('failed');
      }
    };
    load('api/workout_history/read.php', undefined, (data) => setRecords(data.records || []), setHistoryStatus);
    load('api/workout/read_plans.php', undefined, (data) => setHasPlans((data.records || []).length > 0), setPlansStatus);
    load('api/workout_stats/dashboard.php', (data) => data.success, setStats, setDashboardStatus);
  }, [isLoggedIn]);

  const ready = historyStatus !== 'pending' && plansStatus !== 'pending' && dashboardStatus !== 'pending';
  const lastWorkout = records[0] || null;
  // Nuovo = nessun allenamento e nessuna scheda (nemmeno inattiva): la Home propone una sola azione
  const showStartHere = ready && historyStatus === 'ok' && !lastWorkout && plansStatus === 'ok' && !hasPlans;
  const showOpening = ready && !showStartHere && dashboardStatus === 'ok';

  // weekly_goal è l'obiettivo effettivo; plan_days_total resta per i server più vecchi
  const weeklyGoal = stats?.weekly_goal ?? stats?.plan_days_total;
  const weeklyWorkouts = stats?.weekly_workouts || 0;
  const state = showOpening
    ? homeState({ hasDraft: hasFocusSessionInProgress(), trainedToday: stats.trained_today === true, weeklyWorkouts, weeklyGoal })
    : null;
  const red = isLoggedIn && isRedState(state);

  useEffect(() => {
    if (!setBarRed) return undefined;
    setBarRed(red);
    return () => setBarRed(false);
  }, [red, setBarRed]);

  if (!isLoggedIn) {
    return (
      <Suspense fallback={null}>
        <Landing />
      </Suspense>
    );
  }

  const greeting = <Greeting name={user?.username || ''} />;

  const opening = (() => {
    if (!ready) {
      return (
        <Box aria-busy="true" data-testid="home-loading">
          {greeting}
          <Skeleton variant="rounded" height={280} sx={{ mt: 2.5, borderRadius: radius.xxl }} />
        </Box>
      );
    }
    if (showStartHere) {
      return (
        <Box>
          {greeting}
          <Card sx={{ mt: 2.5, p: '22px' }}>
            <Typography component="h2" variant="cardTitle" sx={{ mb: 1 }}>{t('home.start_here.title')}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.5, mb: 2 }}>
              {t('home.start_here.text')}
            </Typography>
            <Button variant="outlined" component={RouterLink} to="/schede" sx={{ borderRadius: radius.lg, fontWeight: 700 }}>
              {t('home.start_here.cta')}
            </Button>
          </Card>
        </Box>
      );
    }
    if (!showOpening) {
      // Dashboard in errore: il saluto e il bottone, senza settimana
      return (
        <Box>
          {greeting}
          <Button variant="contained" component={RouterLink} to="/focus" sx={{ mt: 2.5, borderRadius: radius.lg, px: 3, py: 1.25, fontWeight: 700 }}>
            {t('home.today.start')}
          </Button>
        </Box>
      );
    }
    return (
      <HomeOpening
        state={state}
        name={user?.username || ''}
        nextDay={stats.next_day || null}
        draftDayName={state === 'resume' ? savedDraftDayName() : null}
        todayRecord={state === 'done' ? lastWorkout : null}
        weightUnit={weightUnit}
        weeklyWorkouts={weeklyWorkouts}
        weeklyGoal={weeklyGoal}
        weekDays={Array.isArray(stats.week_days) ? stats.week_days : NO_DAYS}
        todayIdx={todayIndex(stats.today)}
      />
    );
  })();

  // Sul telefono il campo rosso arriva ai bordi: il resto della pagina si dà da solo lo spazio ai lati
  const sidePadding = { xs: red ? 2 : 0, md: 0 };

  return (
    <>
      <Box sx={{ mb: 3 }}>{opening}</Box>

      {ready && !showStartHere && (
        <Box sx={{ px: sidePadding }}>
          <Grid container spacing={3}>
            {/* Ultimo allenamento: nello stato «done» è già nell'apertura */}
            {lastWorkout && state !== 'done' && (
              <Grid item xs={12}>
                <LastWorkout record={lastWorkout} weightUnit={weightUnit} />
              </Grid>
            )}

            {/* Streak / Livello */}
            {levelsOn && (
              <>
                <Grid item xs={12} md={6}>
                  <StreakCard />
                </Grid>
                <Grid item xs={12} md={6}>
                  <LevelCard />
                </Grid>
              </>
            )}

            {/* Stato Muscolare */}
            {recoveryOn && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', p: '22px' }}>
                  <BodyVisualizer recoveryData={stats?.recovery} detail={stats?.detail} />
                  <Button component={RouterLink} to="/dashboard?tab=muscles" size="small" sx={{ mt: 1.5, px: 0 }}>
                    {t('home.recovery_link')}
                  </Button>
                </Card>
              </Grid>
            )}

            {/* Gruppi */}
            {groupsOn && (
              <Grid item xs={12} md={6}>
                <GroupsHomeCard />
              </Grid>
            )}
          </Grid>
        </Box>
      )}
    </>
  );
};

export default Home;

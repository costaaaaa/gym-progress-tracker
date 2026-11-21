import { Suspense, lazy, useState, useEffect } from 'react';
import { Button, Box, Skeleton, Card, Typography } from '@mui/material';
import { Link as RouterLink, useOutletContext } from 'react-router-dom';
import HomeOpening, { Greeting } from '../components/Home/HomeOpening';
import HomeBlocks from '../components/Home/HomeBlocks';
import { useAuth } from '../context/AuthContext';
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
    if (!isLoggedIn) return undefined;
    // Una risposta che arriva dopo l'uscita (logout, cambio pagina) non scrive più lo stato
    let active = true;
    // Le tre richieste partono insieme, ognuna con il suo esito: una che fallisce non ferma le altre
    const load = async (path, accept, onData, setStatus) => {
      try {
        const data = await fetchJson(path, accept);
        if (!active) return;
        if (data) onData(data);
        setStatus(data ? 'ok' : 'failed');
      } catch (error) {
        if (!active) return;
        console.error(`Errore nel caricamento di ${path}:`, error);
        setStatus('failed');
      }
    };
    load('api/workout_history/read.php', undefined, (data) => setRecords(data.records || []), setHistoryStatus);
    load('api/workout/read_plans.php', undefined, (data) => setHasPlans((data.records || []).length > 0), setPlansStatus);
    load('api/workout_stats/dashboard.php', (data) => data.success, setStats, setDashboardStatus);
    return () => { active = false; };
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
  // L'allenamento di oggi: il primo la cui data è `today` del server (non l'orologio del dispositivo); può mancare
  // (fusi diversi): l'apertura «done» allora non ha titolo né riga
  const todayRecord = state === 'done' ? records.find((r) => String(r.date).slice(0, 10) === stats.today) ?? null : null;

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
        todayRecord={todayRecord}
        weightUnit={weightUnit}
        week={{
          workouts: weeklyWorkouts,
          goal: weeklyGoal,
          days: Array.isArray(stats.week_days) ? stats.week_days : NO_DAYS,
          todayIdx: todayIndex(stats.today),
        }}
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
          <HomeBlocks
            layout={user?.home_layout}
            user={user}
            weightUnit={weightUnit}
            lastWorkout={lastWorkout && !todayRecord ? lastWorkout : null}
            stats={stats}
            dashboardStatus={dashboardStatus}
          />
        </Box>
      )}
    </>
  );
};

export default Home;

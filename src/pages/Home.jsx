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
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import TimerIcon from '@mui/icons-material/Timer';
import StarIcon from '@mui/icons-material/Star';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import BodyVisualizer from '../components/BodyVisualizer';
import StreakCard from '../components/StreakCard';
import LevelCard from '../components/LevelCard';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

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
  { key: 'a1', label: '50 Allenamenti', locked: false },
  { key: 'a2', label: '10 Tonnellate Sollevate', locked: false },
  { key: 'a3', label: 'Streak 8 Settimane', locked: true, threshold: '8 settimane' },
  { key: 'a4', label: '100 Allenamenti', locked: true, threshold: '100 sessioni' },
];

// Etichetta "Anteprima" sovrapposta alle card demo della landing: le rende inequivocabilmente
// non interattive/non reali, senza dover toccare lo stile delle card che avvolge.
const PreviewOverlay = ({ children }) => (
  <Box sx={{ position: 'relative' }}>
    {children}
    <Chip
      icon={<VisibilityOutlined sx={{ fontSize: '14px !important' }} />}
      label="Anteprima"
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

  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('it-IT', options);
  };

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
          {isLoggedIn ? `Bentornato, ${user?.username || ''}` : 'Gym Progress Tracker'}
        </Typography>
        <Typography sx={{ fontSize: 16, color: 'rgba(255,255,255,.85)', mb: 3, maxWidth: 560, lineHeight: 1.6 }}>
          {isLoggedIn
            ? 'La tua evoluzione fisica, monitorata con precisione millimetrica.'
            : 'Registra ogni set, sblocca livelli e achievement, e scopri quali muscoli sono pronti a tornare in palestra — tutto in un\'unica app, gratuita.'}
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
            Inizia Allenamento
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              component={RouterLink}
              to="/register"
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
              Registrati Gratis
            </Button>
            <Button
              component={RouterLink}
              to="/login"
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
              Accedi
            </Button>
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
                    Riepilogo Settimanale
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Allenamenti effettuati</Typography>
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
                      ? 'Obiettivo settimanale raggiunto! Ottimo lavoro.'
                      : `Ti mancano ${Math.max(0, (dashboardStats?.plan_days_total || 0) - (dashboardStats?.weekly_workouts || 0))} sessioni per completare il piano.`}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box sx={{ flex: 1, p: 2, bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf5f5' : 'rgba(213, 0, 0, 0.08)', borderRadius: '10px', textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 22, color: 'primary.main' }}>
                        {dashboardStats?.weekly_volume?.total_weight?.toLocaleString() || 0}
                        <Box component="span" sx={{ fontSize: 13, fontWeight: 600, ml: 0.5 }}>kg</Box>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Volume Totale</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 2, bgcolor: (theme) => theme.palette.mode === 'light' ? '#faf5f5' : 'rgba(213, 0, 0, 0.08)', borderRadius: '10px', textAlign: 'center' }}>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 22, color: 'primary.main' }}>
                        {dashboardStats?.weekly_volume?.total_reps?.toLocaleString() || 0}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Reps Totali</Typography>
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

              {/* Ultimo Allenamento */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', borderLeft: '4px solid #d50000' }}>
                  <CardActionArea component={RouterLink} to="/workouts?tab=history" sx={{ height: '100%', p: '26px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: (theme) => theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                        <HistoryOutlined sx={{ color: 'primary.main', fontSize: 22 }} />
                      </Box>
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>Ultimo Allenamento</Typography>
                    </Box>
                    {lastWorkout ? (
                      <>
                        <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: 15, mb: 1 }}>
                          {formatDate(lastWorkout.date)}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
                          Hai completato <strong>{lastWorkout.exercises?.length || 0}</strong> esercizi. Ottimo lavoro!
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
                              +{lastWorkout.exercises.length - 3} ALTRI
                            </Typography>
                          )}
                        </Box>
                      </>
                    ) : (
                      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Nessun allenamento recente. È ora di tornare in palestra!</Typography>
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
                      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>Piano Attivo</Typography>
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
                          {activePlan.description || 'Nessuna descrizione disponibile per questo piano.'}
                        </Typography>
                      </>
                    ) : (
                      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Nessun piano attivo. Scegline uno per ottimizzare i tuoi risultati.</Typography>
                    )}
                  </CardActionArea>
                </Card>
              </Grid>

              {/* Azioni Rapide */}
              <Grid item xs={12}>
                <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2, mt: 2 }}>
                  Azioni Rapide
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <QuickActionPill to="/dashboard?tab=progress" icon={<AssessmentOutlined />} label="Progressi" />
                  <QuickActionPill to="/dashboard?tab=body" icon={<StraightenOutlined />} label="Misure" />
                  <QuickActionPill to="/workouts?tab=history" icon={<CalendarTodayOutlined />} label="Storia" />
                  <QuickActionPill to="/profilo?tab=settings" icon={<HealthAndSafetyOutlined />} label="Impostazioni" />
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      ) : (
        <>
          {/* Showcase: le stesse card che vede un utente loggato, con dati di esempio —
              stessa UI reale dell'app, nessuno screenshot statico da mantenere allineato.
              PreviewOverlay marca ogni card come non reale/non cliccabile, per non farla
              scambiare per i dati effettivi del visitatore. */}
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 0.5 }}>
            L'app in azione
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            Dati di esempio — non sono i tuoi, registrati per vedere i numeri veri.
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
                    Achievement
                  </Typography>
                  <Grid container spacing={1.5}>
                    {PREVIEW_ACHIEVEMENTS.map((a) => (
                      <Grid item xs={6} key={a.key}>
                        <Tooltip title={a.locked ? `Soglia: ${a.threshold}` : 'Sbloccato'} placement="top">
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
                              {a.label}
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
                  Focus Mode
                </Typography>
              </Box>
              <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
                Interfaccia a schermo intero per l'allenamento: timer di recupero automatico,
                feedback aptico e autosave — non perdi mai un set nemmeno se il telefono si blocca.
              </Typography>
            </Box>
            <Chip label="Vibrazione a fine recupero" size="small" sx={{ fontWeight: 600 }} />
          </Card>

          {/* Riepilogo funzionalità aggiuntive, non coperte dallo showcase sopra. */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, height: '100%', borderTop: '4px solid #d50000' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LayersOutlined sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>Piani Illimitati</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  Gestisci più schede in parallelo, con tecniche di intensità come drop set,
                  rest-pause e super set.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, height: '100%', borderTop: '4px solid #d50000' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <StraightenIcon sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>Misure e 1RM</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  Peso, circonferenze e 1RM stimato per esercizio, con grafici sull'andamento nel tempo.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, height: '100%', borderTop: '4px solid #d50000' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <HealthAndSafetyIcon sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>Health Sync</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  Sincronizza automaticamente il peso con Apple Health via iOS Shortcuts.
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 5, mb: 2 }}>
            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 20, mb: 2 }}>
              Pronto a tracciare i tuoi progressi?
            </Typography>
            <Button
              component={RouterLink}
              to="/register"
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
              Registrati Gratis
            </Button>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.5 }}>
              Gratuito, open source, password protette con bcrypt.
            </Typography>
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

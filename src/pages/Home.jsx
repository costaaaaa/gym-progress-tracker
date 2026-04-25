import React, { useState, useEffect } from 'react';
import { Typography, Paper, Grid, Button, Box, Divider, Alert, Snackbar, CircularProgress, Card, CardContent, CardActionArea } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StraightenIcon from '@mui/icons-material/Straighten';
import HistoryIcon from '@mui/icons-material/History';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const Home = () => {
  const { isLoggedIn } = useAuth();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [lastWorkout, setLastWorkout] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
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
      const historyData = await historyResponse.json();
      if (historyData.records && historyData.records.length > 0) {
        setLastWorkout(historyData.records[0]);
      }

      // Fetch plans for the active plan
      const plansResponse = await fetch(`${API_BASE_URL}api/workout/read_plans.php`, {
        credentials: 'include'
      });
      const plansData = await plansResponse.json();
      if (plansData.records) {
        const active = plansData.records.find(plan => plan.is_active);
        setActivePlan(active || null);
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
      <Paper elevation={0} sx={{ p: 6, mb: 4, borderRadius: 4, textAlign: 'center', background: (theme) => theme.palette.mode === 'light' ? 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' : 'linear-gradient(135deg, #141416 0%, #0a0a0b 100%)', border: (theme) => theme.palette.mode === 'light' ? '1px solid #e9ecef' : '1px solid rgba(255,255,255,0.05)' }}>
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom 
          sx={{ fontWeight: 800, mb: 2 }}
        >
          Gym Progress Tracker
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: '700px', mx: 'auto', lineHeight: 1.6 }}>
          {isLoggedIn 
            ? "Bentornato! La tua evoluzione fisica, monitorata con precisione millimetrica."
            : "La piattaforma definitiva per atleti. Gestisci allenamenti, traccia i carichi e analizza i progressi con sincronizzazione Apple Health."
          }
        </Typography>
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
          {isLoggedIn ? (
            <Button 
              variant="contained" 
              color="primary" 
              component={RouterLink} 
              to="/focus"
              startIcon={<PlayArrowIcon />}
              sx={{ py: 1.5, px: 4, fontWeight: 800, fontSize: '1.1rem' }}
            >
              Inizia Allenamento
            </Button>
          ) : (
            <Button 
              variant="contained" 
              color="primary" 
              component={RouterLink} 
              to="/login"
              sx={{ py: 1.5, px: 6, fontWeight: 800, fontSize: '1.1rem' }}
            >
              Accedi / Registrati
            </Button>
          )}
        </Box>
      </Paper>

      {isLoggedIn ? (
        <Grid container spacing={3}>
          {loading ? (
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress color="primary" size={60} thickness={4} />
            </Grid>
          ) : (
            <>
              {/* Ultimo Allenamento */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', borderLeft: (theme) => `6px solid ${theme.palette.primary.main}` }}>
                  <CardActionArea component={RouterLink} to="/workout-history" sx={{ height: '100%', p: 1 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(213, 0, 0, 0.05)' : 'rgba(213, 0, 0, 0.15)', mr: 2 }}>
                          <HistoryIcon sx={{ color: 'primary.main', fontSize: '1.8rem' }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>Ultimo Allenamento</Typography>
                      </Box>
                      {lastWorkout ? (
                        <>
                          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                            {formatDate(lastWorkout.date)}
                          </Typography>
                          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Hai completato <strong>{lastWorkout.exercises?.length || 0}</strong> esercizi. Ottimo lavoro!
                          </Typography>
                          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {lastWorkout.exercises?.slice(0, 3).map((ex, i) => (
                              <Paper key={i} variant="outlined" sx={{ px: 2, py: 0.75, borderRadius: 2, fontSize: '0.85rem', fontWeight: 600 }}>
                                {ex.name}
                              </Paper>
                            ))}
                            {lastWorkout.exercises?.length > 3 && (
                              <Typography variant="caption" sx={{ alignSelf: 'center', ml: 1, fontWeight: 800, color: 'text.secondary' }}>
                                + {lastWorkout.exercises.length - 3} ALTRI
                              </Typography>
                            )}
                          </Box>
                        </>
                      ) : (
                        <Typography variant="body1" color="text.secondary">Nessun allenamento recente. È ora di tornare in palestra!</Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>

              {/* Piano Attivo */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', borderLeft: (theme) => `6px solid ${theme.palette.primary.main}` }}>
                  <CardActionArea component={RouterLink} to="/workout-plans" sx={{ height: '100%', p: 1 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(213, 0, 0, 0.05)' : 'rgba(213, 0, 0, 0.15)', mr: 2 }}>
                          <AssignmentIcon sx={{ color: 'primary.main', fontSize: '1.8rem' }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>Piano Attivo</Typography>
                      </Box>
                      {activePlan ? (
                        <>
                          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
                            {activePlan.name}
                          </Typography>
                          <Typography variant="body1" color="text.secondary">
                            {activePlan.description || "Nessuna descrizione disponibile per questo piano."}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body1" color="text.secondary">Nessun piano attivo. Scegline uno per ottimizzare i tuoi risultati.</Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>

              {/* Link Rapidi */}
              <Grid item xs={12}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 800, mt: 4 }}>Azioni Rapide</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Button 
                      fullWidth variant="outlined" component={RouterLink} to="/progress" 
                      startIcon={<AssessmentIcon />} sx={{ py: 4, flexDirection: 'column', gap: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                      Progressi
                    </Button>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Button 
                      fullWidth variant="outlined" component={RouterLink} to="/body-stats" 
                      startIcon={<StraightenIcon />} sx={{ py: 4, flexDirection: 'column', gap: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                      Misure
                    </Button>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Button 
                      fullWidth variant="outlined" component={RouterLink} to="/workout-history" 
                      startIcon={<CalendarTodayIcon />} sx={{ py: 4, flexDirection: 'column', gap: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                      Storia
                    </Button>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Button 
                      fullWidth variant="outlined" component={RouterLink} to="/account" 
                      startIcon={<HealthAndSafetyIcon />} sx={{ py: 4, flexDirection: 'column', gap: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                      Account
                    </Button>
                  </Grid>
                </Grid>
              </Grid>
            </>
          )}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 4, height: '100%', borderTop: (theme) => `6px solid ${theme.palette.primary.main}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FitnessCenterIcon sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Allenamenti</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                Registra ogni set, ripetizione e peso. Gestisci le tue schede in modo professionale.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 4, height: '100%', borderTop: (theme) => `6px solid ${theme.palette.primary.main}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StraightenIcon sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Misure</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                Tieni traccia del peso e delle circonferenze corporee per visualizzare il tuo cambiamento.
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 4, height: '100%', borderTop: (theme) => `6px solid ${theme.palette.primary.main}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HealthAndSafetyIcon sx={{ mr: 2, color: 'primary.main', fontSize: '2rem' }} />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Health Sync</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                Sincronizza automaticamente i tuoi dati con Apple Health per un monitoraggio a 360 gradi.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
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
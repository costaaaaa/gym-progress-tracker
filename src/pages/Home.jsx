import React, { useState } from 'react';
import { Typography, Paper, Grid, Button, Box, Divider, Alert, Snackbar } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useAuth } from '../context/AuthContext';

import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AssessmentIcon from '@mui/icons-material/Assessment';

const Home = () => {
  const { isLoggedIn } = useAuth();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  return (
    <>
      <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3, background: 'linear-gradient(to right bottom, #ffffff, #f8f8f8)' }}>
        <Typography variant="h4" component="h1" gutterBottom className="section-title" sx={{ fontWeight: 800, color: '#212121', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 2, textShadow: '0px 1px 2px rgba(0,0,0,0.1)' }}>
          Gym Progress Tracker <span style={{ color: '#d50000' }}>v2.1</span>
        </Typography>
        <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.6, color: '#333333' }}>
          La tua piattaforma completa per il fitness. Gestisci allenamenti, monitora i carichi, traccia le misure corporee e sincronizza i tuoi dati con Apple Health.
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {isLoggedIn ? (
            <>
              <Button 
                variant="contained" 
                color="primary" 
                component={RouterLink} 
                to="/focus"
                startIcon={<PlayArrowIcon />}
                sx={{ 
                  py: 1.5, px: 4, fontWeight: 'bold',
                  fontSize: '1.1rem',
                  background: 'linear-gradient(45deg, #c62828 0%, #e53935 100%)',
                  boxShadow: '0 4px 16px rgba(229, 57, 53, 0.35)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #b71c1c 0%, #c62828 100%)',
                    boxShadow: '0 6px 20px rgba(229, 57, 53, 0.5)',
                    transform: 'translateY(-3px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Inizia Allenamento
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                component={RouterLink} 
                to="/body-stats"
                startIcon={<StraightenIcon />}
                sx={{ py: 1.5, px: 3, fontWeight: 'bold' }}
              >
                Misure e Peso
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                component={RouterLink} 
                to="/progress"
                startIcon={<AssessmentIcon />}
                sx={{ py: 1.5, px: 3, fontWeight: 'bold' }}
              >
                Analisi Progressi
              </Button>
            </>
          ) : (
            <Button 
              variant="contained" 
              color="primary" 
              component={RouterLink} 
              to="/login"
              sx={{ py: 1.5, px: 4, fontWeight: 'bold' }}
            >
              Accedi per Iniziare
            </Button>
          )}
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', borderTop: '4px solid #d50000' }} className="workout-card">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <FitnessCenterIcon sx={{ mr: 1, color: '#d50000' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>Allenamenti</Typography>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              Gestisci le tue schede personalizzate e registra ogni sessione in tempo reale con il timer di recupero integrato.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', borderTop: '4px solid #d50000' }} className="workout-card">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <StraightenIcon sx={{ mr: 1, color: '#d50000' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>Statistiche Fisiche</Typography>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              Monitora peso, massa grassa e circonferenze. Visualizza l'evoluzione del tuo fisico attraverso grafici dettagliati.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', borderTop: '4px solid #d50000' }} className="workout-card">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <HealthAndSafetyIcon sx={{ mr: 1, color: '#d50000' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>Apple Health Sync</Typography>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              Sincronizzazione automatica del peso da iPhone. I tuoi dati di salute sempre aggiornati senza inserimenti manuali.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, bgcolor: '#f1f8e9', borderLeft: '6px solid #4caf50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AssessmentIcon sx={{ mr: 1, color: '#2e7d32' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>Novità: Analisi Avanzata</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Scopri i nuovi grafici di <strong>Volume Totale</strong> e <strong>Frequenza Settimanale</strong> nella sezione Progressi per ottimizzare il tuo sovraccarico progressivo.
            </Typography>
          </Paper>
        </Grid>
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
import React, { useState } from 'react';
import { Typography, Paper, Grid, Button, Box, Divider, Alert, Snackbar } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isLoggedIn } = useAuth();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  return (
    <>
      <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3, background: 'linear-gradient(to right bottom, #ffffff, #f0f0f0)' }}>
        <Typography variant="h4" component="h1" gutterBottom className="section-title" sx={{ fontWeight: 800, color: '#212121', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 2, textShadow: '0px 1px 2px rgba(0,0,0,0.1)' }}>
          Benvenuto nel tuo Gym Progress Tracker
        </Typography>
        <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.6, color: '#333333' }}>
          Questa applicazione ti aiuterà a tenere traccia dei tuoi progressi in palestra, gestire le tue schede di allenamento e visualizzare i tuoi miglioramenti nel tempo.
        </Typography>
        <Box sx={{ mt: 3 }}>
          {isLoggedIn ? (
            <>
              <Button 
                variant="contained" 
                color="primary" 
                component={RouterLink} 
                to="/workout-plans"
                startIcon={<FitnessCenterIcon />}
                sx={{ mr: 2, py: 1.2, px: 3, fontWeight: 'bold', mb: { xs: 2, sm: 2, md: 0 } }}
                className="workout-card"
              >
                Visualizza Schede
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                component={RouterLink} 
                to="/progress"
                startIcon={<DirectionsRunIcon />}
                sx={{ py: 1.2, px: 3, fontWeight: 'bold', mr: 2, mb: { xs: 2, sm: 2, md: 0 } }}
              >
                Controlla Progressi
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                component={RouterLink} 
                to="/workout-history"
                startIcon={<CalendarTodayIcon />}
                sx={{ py: 1.2, px: 3, fontWeight: 'bold', mr: 2, mb: { xs: 2, sm: 2, md: 0 } }}
              >
                Cronologia Allenamenti
              </Button>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Effettua il login per accedere alle tue schede e ai tuoi progressi
            </Typography>
          )}
        </Box>
        </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', backgroundColor: '#ffffff' }} className="workout-card">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <FitnessCenterIcon sx={{ mr: 1, color: '#d50000' }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 0, color: '#333333' }}>
                Gestisci Schede
              </Typography>
            </Box>
            <Divider sx={{ my: 1.5, borderColor: 'rgba(213, 0, 0, 0.1)' }} />
            <Typography variant="body2" sx={{ lineHeight: 1.6, color: '#444444' }}>
              Crea e gestisci le tue schede di allenamento suddivise in 3 giorni, con esercizi, ripetizioni e tempi di recupero personalizzati.
            </Typography>
            </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', backgroundColor: '#ffffff' }} className="workout-card">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarTodayIcon sx={{ mr: 1, color: '#d50000' }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 0, color: '#333333' }}>
                Registra Allenamenti
              </Typography>
            </Box>
            <Divider sx={{ my: 1.5, borderColor: 'rgba(213, 0, 0, 0.1)' }} />
            <Typography variant="body2" sx={{ lineHeight: 1.6, color: '#444444' }}>
              Registra i tuoi allenamenti quotidiani, tenendo traccia dei pesi sollevati, delle ripetizioni effettuate e delle sensazioni durante l'esercizio.
            </Typography>
            </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%', backgroundColor: '#ffffff' }} className="workout-card">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <DirectionsRunIcon sx={{ mr: 1, color: '#d50000' }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 0, color: '#333333' }}>
                Analizza Progressi
              </Typography>
            </Box>
            <Divider sx={{ my: 1.5, borderColor: 'rgba(213, 0, 0, 0.1)' }} />
            <Typography variant="body2" sx={{ lineHeight: 1.6, color: '#444444' }}>
              Visualizza grafici dettagliati dei tuoi progressi suddivisi per gruppo muscolare e monitora la tua evoluzione nel tempo.
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
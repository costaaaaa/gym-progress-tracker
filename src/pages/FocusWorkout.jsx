import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  LinearProgress,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Collapse,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Fade,
  Slide,
  Divider
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  SkipNext as SkipNextIcon,
  Check as CheckIcon,
  FitnessCenter as FitnessCenterIcon,
  Timer as TimerIcon,
  TimerOff as TimerOffIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  NavigateNext as NavigateNextIcon,
  Info as InfoIcon,
  EmojiEvents as TrophyIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { INTENSITY_TECHNIQUES } from '../components/ExerciseDialog';

// ================================================
// TEMA SCURO PER FOCUS MODE
// ================================================
const focusTheme = {
  bg: '#121212',
  bgCard: '#1e1e1e',
  bgElevated: '#2a2a2a',
  primary: '#e53935',
  primaryLight: '#ff6f60',
  primaryDark: '#ab000d',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  textMuted: '#757575',
  success: '#4caf50',
  warning: '#ff9800',
  border: '#333333',
  timerBg: 'rgba(229, 57, 53, 0.08)',
};

const DRAFT_STORAGE_KEY = 'gym_focus_workout_draft';

const FocusWorkout = () => {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  // ================================================
  // STATE
  // ================================================
  const [phase, setPhase] = useState('loading'); // loading | select_day | workout | rest_timer | summary | resume_prompt
  const [activePlan, setActivePlan] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [timerEnabled, setTimerEnabled] = useState(true);

  // Workout state
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState({});
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [intensityTechniqueInput, setIntensityTechniqueInput] = useState('');
  const [skippedExercises, setSkippedExercises] = useState([]);

  // Timer state
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const timerRef = useRef(null);

  // Summary state
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [saving, setSaving] = useState(false);

  // UI state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmQuitDialog, setConfirmQuitDialog] = useState(false);
  const [exerciseTransition, setExerciseTransition] = useState(true);
  const [draftToResume, setDraftToResume] = useState(null);

  // ================================================
  // AUTOSAVE LOGIC
  // ================================================
  useEffect(() => {
    // Salva solo se siamo in una fase attiva di allenamento
    if (['workout', 'rest_timer', 'summary'].includes(phase) && selectedDay) {
      const draft = {
        activePlan,
        selectedDay,
        selectedDayId,
        completedSets,
        skippedExercises,
        currentExerciseIndex,
        currentSetIndex,
        workoutNotes,
        startTime,
        phase: phase === 'rest_timer' ? 'workout' : phase, // Se crasha durante il timer, riprendi dall'esercizio
        timestamp: new Date().getTime()
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [phase, activePlan, selectedDay, selectedDayId, completedSets, skippedExercises, currentExerciseIndex, currentSetIndex, workoutNotes, startTime]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  // ================================================
  // AUTH GUARD
  // ================================================
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, authLoading, navigate]);

  // ================================================
  // CARICA PIANO ATTIVO E IMPOSTAZIONI UTENTE
  // ================================================
  useEffect(() => {
    if (isLoggedIn) {
      loadInitialData();
    }
  }, [isLoggedIn]);

  const loadInitialData = async () => {
    try {
      // Verifica prima se esiste una bozza
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          // La bozza è valida solo se ha i dati minimi e appartiene allo stesso giorno (opzionale, ma qui la teniamo valida per UX)
          if (parsed.selectedDay && parsed.startTime) {
            setDraftToResume(parsed);
            setPhase('resume_prompt');
            // Continuiamo comunque il caricamento per avere i dati aggiornati del piano
          }
        } catch (e) {
          console.error("Errore parsing bozza:", e);
          clearDraft();
        }
      }

      // Carica piano attivo e impostazioni in parallelo
      const [plansRes, userRes] = await Promise.all([
        fetch(`${API_BASE_URL}api/workout/read_plans.php`, { method: 'GET', credentials: 'include' }),
        fetch(`${API_BASE_URL}api/user/read.php`, { method: 'GET', credentials: 'include' })
      ]);

      const plansData = await plansRes.json();
      const userData = await userRes.json();

      // Impostazioni utente
      if (userData.rest_timer_enabled !== undefined) {
        setTimerEnabled(userData.rest_timer_enabled);
      }

      // Trova piano attivo
      if (plansData.records) {
        const active = plansData.records.find(p => p.is_active);
        if (active) {
          setActivePlan(active);
          // Se non c'è bozza, vai alla selezione giorno
          if (phase !== 'resume_prompt') {
            setPhase('select_day');
          }
        } else {
          setSnackbar({ open: true, message: 'Nessun piano attivo trovato. Attiva un piano dalle Schede.', severity: 'warning' });
          if (phase !== 'resume_prompt') {
            setPhase('select_day');
          }
        }
      } else {
        if (phase !== 'resume_prompt') {
          setPhase('select_day');
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      setSnackbar({ open: true, message: 'Errore nel caricamento dei dati', severity: 'error' });
      if (phase !== 'resume_prompt') {
        setPhase('select_day');
      }
    }
  };

  // ================================================
  // GESTIONE BOZZA
  // ================================================
  const handleResumeDraft = () => {
    if (!draftToResume) return;

    setActivePlan(draftToResume.activePlan);
    setSelectedDay(draftToResume.selectedDay);
    setSelectedDayId(draftToResume.selectedDayId);
    setCompletedSets(draftToResume.completedSets);
    setSkippedExercises(draftToResume.skippedExercises);
    setCurrentExerciseIndex(draftToResume.currentExerciseIndex);
    setCurrentSetIndex(draftToResume.currentSetIndex);
    setWorkoutNotes(draftToResume.workoutNotes);
    setStartTime(new Date(draftToResume.startTime));
    
    // Ripristina input correnti
    const currentEx = draftToResume.selectedDay.exercises[draftToResume.currentExerciseIndex];
    setRepsInput(currentEx?.reps || '');
    setIntensityTechniqueInput(currentEx?.intensity_technique || '');

    setPhase(draftToResume.phase || 'workout');
    setDraftToResume(null);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraftToResume(null);
    setPhase('select_day');
  };

  // ================================================
  // GESTIONE SELEZIONE GIORNO
  // ================================================
  const handleDayChange = (event) => {
    const dayId = event.target.value;
    setSelectedDayId(dayId);
    const day = activePlan?.days?.find(d => d.id === dayId);
    setSelectedDay(day || null);
  };

  const handleStartWorkout = () => {
    if (!selectedDay || !selectedDay.exercises || selectedDay.exercises.length === 0) return;

    // Inizializza
    setCurrentExerciseIndex(0);
    setCurrentSetIndex(0);
    setCompletedSets({});
    setSkippedExercises([]);
    setWorkoutNotes('');
    setStartTime(new Date());

    // Pre-compila reps dal piano
    const firstExercise = selectedDay.exercises[0];
    setRepsInput(firstExercise.reps || '');
    setIntensityTechniqueInput(firstExercise.intensity_technique || '');
    setWeightInput('');

    setPhase('workout');
  };

  // ================================================
  // ESERCIZIO CORRENTE
  // ================================================
  const currentExercise = selectedDay?.exercises?.[currentExerciseIndex];
  const totalExercises = selectedDay?.exercises?.length || 0;
  const totalSetsForCurrentExercise = currentExercise?.sets || 0;
  const currentExerciseSets = completedSets[currentExercise?.id] || [];

  // ================================================
  // CONFERMA SERIE
  // ================================================
  const handleConfirmSet = () => {
    if (!weightInput || !repsInput) return;

    const exerciseId = currentExercise.id;
    const newSet = {
      setNumber: currentSetIndex + 1,
      weight: parseFloat(weightInput),
      reps: repsInput.toString(),
      intensity_technique: intensityTechniqueInput
    };

    setCompletedSets(prev => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] || []), newSet]
    }));

    const nextSetIndex = currentSetIndex + 1;

    if (nextSetIndex >= totalSetsForCurrentExercise) {
      // Tutte le serie completate per questo esercizio
      goToNextExercise();
    } else {
      // Prossima serie
      setCurrentSetIndex(nextSetIndex);
      setWeightInput('');
      // Mantieni le reps dal piano come default
      setRepsInput(currentExercise.reps || '');
      setIntensityTechniqueInput(currentExercise.intensity_technique || '');

      // Avvia timer di recupero se abilitato
      if (timerEnabled && currentExercise.rest > 0) {
        startRestTimer(currentExercise.rest);
      }
    }
  };

  // ================================================
  // NAVIGAZIONE TRA ESERCIZI
  // ================================================
  const goToNextExercise = useCallback(() => {
    // Trova il prossimo esercizio non saltato
    let nextIndex = currentExerciseIndex + 1;
    while (nextIndex < totalExercises && skippedExercises.includes(nextIndex)) {
      nextIndex++;
    }

    if (nextIndex >= totalExercises) {
      // Tutti gli esercizi completati → riepilogo
      setPhase('summary');
    } else {
      // Transizione animata
      setExerciseTransition(false);
      setTimeout(() => {
        setCurrentExerciseIndex(nextIndex);
        setCurrentSetIndex(0);
        const nextExercise = selectedDay.exercises[nextIndex];
        setRepsInput(nextExercise?.reps || '');
        setIntensityTechniqueInput(nextExercise?.intensity_technique || '');
        setWeightInput('');
        setExerciseTransition(true);
      }, 200);
    }
  }, [currentExerciseIndex, totalExercises, skippedExercises, selectedDay]);

  const handleSkipExercise = () => {
    setSkippedExercises(prev => [...prev, currentExerciseIndex]);
    goToNextExercise();
  };

  // ================================================
  // TIMER DI RECUPERO
  // ================================================
  const startRestTimer = (durationSeconds) => {
    setTimerDuration(durationSeconds);
    setTimerRemaining(durationSeconds);
    setPhase('rest_timer');

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimerRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          // Vibrazione se supportata
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          setPhase('workout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSkipTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRemaining(0);
    setPhase('workout');
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ================================================
  // FORMATO TIMER
  // ================================================
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tempo totale allenamento
  const getElapsedTime = () => {
    if (!startTime) return '00:00';
    const elapsed = Math.floor((new Date() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ================================================
  // SALVATAGGIO ALLENAMENTO
  // ================================================
  const handleSave = async () => {
    setSaving(true);

    try {
      // Costruisci workout_records nel formato atteso dal backend
      const workoutRecords = [];

      Object.entries(completedSets).forEach(([exerciseId, sets]) => {
        // Trova l'esercizio per ottenere l'exercise_id originale
        const exercise = selectedDay.exercises.find(e => e.id.toString() === exerciseId.toString());
        if (!exercise) return;

        sets.forEach(set => {
          workoutRecords.push({
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
            weight: set.weight,
            reps: set.reps,
            intensity_technique: set.intensity_technique,
            day_id: selectedDayId,
            set_number: set.setNumber
          });
        });
      });

      if (workoutRecords.length === 0) {
        setSnackbar({ open: true, message: 'Nessuna serie completata da salvare', severity: 'warning' });
        setSaving(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}api/workout/record_workout.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workout_records: workoutRecords,
          notes: workoutNotes || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante il salvataggio');
      }

      setSnackbar({ open: true, message: 'Allenamento salvato con successo! 💪', severity: 'success' });
      clearDraft();

      // Redirect dopo un breve delay
      setTimeout(() => {
        navigate('/workout-history');
      }, 1500);

    } catch (error) {
      console.error('Errore salvataggio:', error);
      setSnackbar({ open: true, message: error.message || 'Errore durante il salvataggio', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ================================================
  // QUIT / BACK
  // ================================================
  const handleQuit = () => {
    if (phase === 'workout' || phase === 'rest_timer' || phase === 'summary') {
      setConfirmQuitDialog(true);
    } else {
      navigate('/');
    }
  };

  const confirmQuit = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clearDraft();
    setConfirmQuitDialog(false);
    navigate('/');
  };

  // ================================================
  // CONTEGGIO TOTALE SERIE COMPLETATE
  // ================================================
  const getTotalCompletedSets = () => {
    return Object.values(completedSets).reduce((total, sets) => total + sets.length, 0);
  };

  // ================================================
  // RENDER — CONTENUTO IN BASE ALLA FASE
  // ================================================
  const renderContent = () => {
    if (phase === 'loading' || authLoading) {
      return (
        <Box sx={{
          minHeight: '100vh', bgcolor: focusTheme.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <CircularProgress sx={{ color: focusTheme.primary }} />
        </Box>
      );
    }

    if (phase === 'resume_prompt' && draftToResume) {
      return (
        <Box sx={{ 
          minHeight: '100vh', bgcolor: focusTheme.bg, color: focusTheme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3
        }}>
          <Paper sx={{ 
            bgcolor: focusTheme.bgCard, p: 4, borderRadius: 4, maxWidth: 400, textAlign: 'center',
            border: `1px solid ${focusTheme.border}`,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <HistoryIcon sx={{ fontSize: 64, color: focusTheme.warning, mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Allenamento in sospeso
            </Typography>
            <Typography variant="body1" sx={{ color: focusTheme.textSecondary, mb: 1 }}>
              Hai un allenamento non salvato per il giorno:
            </Typography>
            <Typography variant="h6" sx={{ color: focusTheme.primaryLight, fontWeight: 600, mb: 1 }}>
              {draftToResume.selectedDay?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: focusTheme.textMuted, mb: 4 }}>
              Iniziato il {new Date(draftToResume.startTime).toLocaleString('it-IT')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleResumeDraft}
                sx={{ 
                  bgcolor: focusTheme.primary, py: 1.5, fontWeight: 700, borderRadius: 2,
                  '&:hover': { bgcolor: focusTheme.primaryDark }
                }}
              >
                Riprendi Allenamento
              </Button>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={handleDiscardDraft}
                sx={{ 
                  color: focusTheme.textSecondary, borderColor: focusTheme.border, py: 1.5, borderRadius: 2,
                  '&:hover': { borderColor: focusTheme.primary, color: focusTheme.primaryLight }
                }}
              >
                Scarta e Inizia Nuovo
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    if (phase === 'select_day') {
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: focusTheme.bg, color: focusTheme.text }}>
          <Box sx={{
            p: 2, display: 'flex', alignItems: 'center', gap: 1,
            borderBottom: `1px solid ${focusTheme.border}`
          }}>
            <IconButton onClick={() => navigate('/')} sx={{ color: focusTheme.text }}>
              <ArrowBackIcon />
            </IconButton>
            <FitnessCenterIcon sx={{ color: focusTheme.primary }} />
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1 }}>
              FOCUS MODE
            </Typography>
          </Box>

          <Container maxWidth="sm" sx={{ py: 4 }}>
            {!activePlan ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <FitnessCenterIcon sx={{ fontSize: 64, color: focusTheme.textMuted, mb: 2 }} />
                <Typography variant="h6" sx={{ color: focusTheme.textSecondary, mb: 2 }}>
                  Nessun piano attivo
                </Typography>
                <Typography variant="body2" sx={{ color: focusTheme.textMuted, mb: 3 }}>
                  Vai alle Schede e attiva un piano di allenamento
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/workout-plans')}
                  sx={{ color: focusTheme.primary, borderColor: focusTheme.primary }}
                >
                  Vai alle Schede
                </Button>
              </Box>
            ) : (
              <>
                <Paper sx={{
                  bgcolor: focusTheme.bgCard, p: 3, mb: 3, borderRadius: 3,
                  border: `1px solid ${focusTheme.border}`
                }}>
                  <Typography variant="overline" sx={{ color: focusTheme.textMuted, letterSpacing: 2 }}>
                    Piano attivo
                  </Typography>
                  <Typography variant="h5" sx={{ color: focusTheme.text, fontWeight: 700, mb: 3 }}>
                    {activePlan.name}
                  </Typography>

                  <FormControl fullWidth sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      color: focusTheme.text,
                      '& fieldset': { borderColor: focusTheme.border },
                      '&:hover fieldset': { borderColor: focusTheme.primary },
                      '&.Mui-focused fieldset': { borderColor: focusTheme.primary },
                    },
                    '& .MuiInputLabel-root': { color: focusTheme.textSecondary },
                    '& .MuiInputLabel-root.Mui-focused': { color: focusTheme.primary },
                    '& .MuiSvgIcon-root': { color: focusTheme.textSecondary },
                  }}>
                    <InputLabel>Seleziona Giorno</InputLabel>
                    <Select
                      value={selectedDayId}
                      label="Seleziona Giorno"
                      onChange={handleDayChange}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            bgcolor: focusTheme.bgElevated,
                            color: focusTheme.text,
                            '& .MuiMenuItem-root:hover': { bgcolor: 'rgba(229, 57, 53, 0.15)' }
                          }
                        }
                      }}
                    >
                      {activePlan.days?.map((day) => (
                        <MenuItem key={day.id} value={day.id}>{day.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedDay && selectedDay.exercises && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: focusTheme.textMuted, mb: 1.5, letterSpacing: 1 }}>
                        ESERCIZI ({selectedDay.exercises.length})
                      </Typography>
                      {selectedDay.exercises.map((ex, idx) => (
                        <Box key={ex.id} sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          py: 1.5, borderBottom: idx < selectedDay.exercises.length - 1 ? `1px solid ${focusTheme.border}` : 'none'
                        }}>
                          <Box>
                            <Typography variant="body1" sx={{ color: focusTheme.text, fontWeight: 500 }}>
                              {ex.exercise_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>
                              {ex.sets} serie × {ex.reps} — Recupero: {ex.rest}s
                              {ex.intensity_technique && ` — ${ex.intensity_technique}`}
                            </Typography>
                          </Box>
                          <Chip
                            label={ex.muscle_group}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(229, 57, 53, 0.15)',
                              color: focusTheme.primaryLight,
                              fontWeight: 500,
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  disabled={!selectedDay || !selectedDay.exercises || selectedDay.exercises.length === 0}
                  onClick={handleStartWorkout}
                  sx={{
                    py: 2, fontSize: '1.2rem', fontWeight: 700, letterSpacing: 1,
                    bgcolor: focusTheme.primary, color: '#fff', borderRadius: 3, textTransform: 'uppercase',
                    boxShadow: '0 4px 20px rgba(229, 57, 53, 0.4)',
                    '&:hover': { bgcolor: focusTheme.primaryDark, boxShadow: '0 6px 24px rgba(229, 57, 53, 0.5)', transform: 'translateY(-2px)' },
                    '&:disabled': { bgcolor: focusTheme.bgElevated, color: focusTheme.textMuted },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Inizia Allenamento
                </Button>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2, gap: 1 }}>
                  {timerEnabled ? (
                    <>
                      <TimerIcon sx={{ fontSize: 16, color: focusTheme.success }} />
                      <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>Timer di recupero attivo</Typography>
                    </>
                  ) : (
                    <>
                      <TimerOffIcon sx={{ fontSize: 16, color: focusTheme.textMuted }} />
                      <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>Timer di recupero disattivato</Typography>
                    </>
                  )}
                </Box>
              </>
            )}
          </Container>
        </Box>
      );
    }

    if (phase === 'rest_timer') {
      const progress = timerDuration > 0 ? ((timerDuration - timerRemaining) / timerDuration) * 100 : 0;
      return (
        <Box sx={{
          minHeight: '100vh', bgcolor: focusTheme.bg, color: focusTheme.text,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3
        }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
            <CircularProgress variant="determinate" value={progress} size={220} thickness={4}
              sx={{ color: focusTheme.primary, '& .MuiCircularProgress-circle': { strokeLinecap: 'round', transition: 'stroke-dashoffset 1s linear' } }} />
            <CircularProgress variant="determinate" value={100} size={220} thickness={4}
              sx={{ color: focusTheme.border, position: 'absolute', left: 0, zIndex: 0 }} />
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Typography variant="h2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: focusTheme.text }}>{formatTime(timerRemaining)}</Typography>
              <Typography variant="caption" sx={{ color: focusTheme.textMuted, mt: 0.5 }}>RECUPERO</Typography>
            </Box>
          </Box>
          <Typography variant="body1" sx={{ color: focusTheme.textSecondary, mb: 1 }}>{currentExercise?.exercise_name}</Typography>
          <Typography variant="body2" sx={{ color: focusTheme.textMuted, mb: 4 }}>Prossima: Serie {currentSetIndex + 1} di {totalSetsForCurrentExercise}</Typography>
          <Button variant="outlined" size="large" startIcon={<SkipNextIcon />} onClick={handleSkipTimer}
            sx={{ color: focusTheme.text, borderColor: focusTheme.border, borderRadius: 3, px: 4, py: 1.5, fontSize: '1rem',
              '&:hover': { borderColor: focusTheme.primary, bgcolor: 'rgba(229, 57, 53, 0.08)' } }}>
            Salta Timer
          </Button>
        </Box>
      );
    }

    if (phase === 'workout' && currentExercise) {
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: focusTheme.bg, color: focusTheme.text, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${focusTheme.border}` }}>
            <IconButton onClick={handleQuit} sx={{ color: focusTheme.textSecondary }}><CloseIcon /></IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 16, color: focusTheme.textMuted }} />
              <Typography variant="caption" sx={{ color: focusTheme.textMuted, fontFamily: 'monospace' }}>{getElapsedTime()}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>{currentExerciseIndex + 1}/{totalExercises}</Typography>
          </Box>

          <LinearProgress variant="determinate" value={((currentExerciseIndex) / totalExercises) * 100}
            sx={{ height: 3, bgcolor: focusTheme.border, '& .MuiLinearProgress-bar': { bgcolor: focusTheme.primary } }} />

          <Fade in={exerciseTransition} timeout={300}>
            <Container maxWidth="sm" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Chip label={currentExercise.muscle_group} size="small" sx={{ bgcolor: 'rgba(229, 57, 53, 0.15)', color: focusTheme.primaryLight, mb: 1, fontWeight: 500 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: focusTheme.text, lineHeight: 1.2 }}>{currentExercise.exercise_name}</Typography>
                {currentExercise.notes && (
                  <Alert severity="info" icon={<InfoIcon sx={{ color: focusTheme.primaryLight }} />}
                    sx={{ mt: 2, bgcolor: 'rgba(229, 57, 53, 0.08)', color: focusTheme.textSecondary, '& .MuiAlert-icon': { color: focusTheme.primaryLight }, border: `1px solid ${focusTheme.border}`, borderRadius: 2 }}>
                    {currentExercise.notes}
                  </Alert>
                )}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 3 }}>
                {Array(totalSetsForCurrentExercise).fill(null).map((_, idx) => (
                  <Box key={idx} sx={{
                    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${idx < currentSetIndex ? focusTheme.success : idx === currentSetIndex ? focusTheme.primary : focusTheme.border}`,
                    bgcolor: idx < currentSetIndex ? focusTheme.success : 'transparent',
                    color: idx < currentSetIndex ? '#fff' : idx === currentSetIndex ? focusTheme.primary : focusTheme.textMuted,
                    fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.3s ease'
                  }}>
                    {idx < currentSetIndex ? <CheckIcon sx={{ fontSize: 18 }} /> : idx + 1}
                  </Box>
                ))}
              </Box>

              <Typography variant="subtitle2" sx={{ textAlign: 'center', color: focusTheme.textMuted, mb: 3, letterSpacing: 1 }}>
                SERIE {currentSetIndex + 1} DI {totalSetsForCurrentExercise}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField label="Peso (kg)" type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
                  fullWidth autoFocus inputProps={{ step: 0.5, min: 0, inputMode: 'decimal' }}
                  sx={{ '& .MuiOutlinedInput-root': { color: focusTheme.text, fontSize: '1.2rem', fontWeight: 700, '& fieldset': { borderColor: focusTheme.border, borderWidth: 2 }, '&:hover fieldset': { borderColor: focusTheme.primary }, '&.Mui-focused fieldset': { borderColor: focusTheme.primary } }, '& .MuiInputLabel-root': { color: focusTheme.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: focusTheme.primary } }} />
                <TextField label="Ripetizioni" value={repsInput} onChange={(e) => setRepsInput(e.target.value)}
                  fullWidth inputProps={{ inputMode: 'text' }}
                  sx={{ '& .MuiOutlinedInput-root': { color: focusTheme.text, fontSize: '1.2rem', fontWeight: 700, '& fieldset': { borderColor: focusTheme.border, borderWidth: 2 }, '&:hover fieldset': { borderColor: focusTheme.primary }, '&.Mui-focused fieldset': { borderColor: focusTheme.primary } }, '& .MuiInputLabel-root': { color: focusTheme.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: focusTheme.primary } }} />
              </Box>

              <FormControl fullWidth sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  color: focusTheme.text,
                  '& fieldset': { borderColor: focusTheme.border, borderWidth: 2 },
                  '&:hover fieldset': { borderColor: focusTheme.primary },
                  '&.Mui-focused fieldset': { borderColor: focusTheme.primary },
                },
                '& .MuiInputLabel-root': { color: focusTheme.textSecondary },
                '& .MuiInputLabel-root.Mui-focused': { color: focusTheme.primary },
                '& .MuiSvgIcon-root': { color: focusTheme.textSecondary },
              }}>
                <InputLabel>Tecnica di Intensità</InputLabel>
                <Select
                  value={intensityTechniqueInput}
                  label="Tecnica di Intensità"
                  onChange={(e) => setIntensityTechniqueInput(e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: focusTheme.bgElevated,
                        color: focusTheme.text,
                        '& .MuiMenuItem-root:hover': { bgcolor: 'rgba(229, 57, 53, 0.15)' }
                      }
                    }
                  }}
                >
                  <MenuItem value=""><em>Nessuna</em></MenuItem>
                  {INTENSITY_TECHNIQUES.filter(t => t !== 'Nessuna (Normale)').map((tech) => (
                    <MenuItem key={tech} value={tech}>{tech}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button variant="contained" fullWidth size="large" startIcon={<CheckIcon />} onClick={handleConfirmSet} disabled={!weightInput || !repsInput}
                sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, letterSpacing: 1, bgcolor: focusTheme.success, color: '#fff', borderRadius: 3,
                  boxShadow: '0 4px 16px rgba(76, 175, 80, 0.3)', '&:hover': { bgcolor: '#388e3c', boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4)' },
                  '&:disabled': { bgcolor: focusTheme.bgElevated, color: focusTheme.textMuted }, mb: 2, transition: 'all 0.3s ease' }}>
                Conferma Serie
              </Button>

              <Button variant="text" startIcon={<SkipNextIcon />} onClick={handleSkipExercise}
                sx={{ color: focusTheme.textMuted, '&:hover': { color: focusTheme.textSecondary, bgcolor: 'rgba(255,255,255,0.05)' }, mb: 3 }}>
                Salta Esercizio
              </Button>

              {currentExerciseSets.length > 0 && (
                <Paper sx={{ bgcolor: focusTheme.bgCard, borderRadius: 2, overflow: 'hidden', border: `1px solid ${focusTheme.border}` }}>
                  <Box sx={{ px: 2, py: 1.5, bgcolor: focusTheme.bgElevated }}>
                    <Typography variant="subtitle2" sx={{ color: focusTheme.textMuted, letterSpacing: 1 }}>SERIE COMPLETATE</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border }}>#</TableCell>
                          <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border }}>Peso</TableCell>
                          <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border }}>Reps</TableCell>
                          <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border }}>Tecnica</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentExerciseSets.map((set) => (
                          <TableRow key={set.setNumber}>
                            <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border }}>{set.setNumber}</TableCell>
                            <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border, fontWeight: 600 }}>{set.weight} kg</TableCell>
                            <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border }}>{set.reps}</TableCell>
                            <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border }}>{set.intensity_technique || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
            </Container>
          </Fade>

          <Dialog open={confirmQuitDialog} onClose={() => setConfirmQuitDialog(false)}
            PaperProps={{ sx: { bgcolor: focusTheme.bgCard, color: focusTheme.text, borderRadius: 3 } }}>
            <DialogTitle sx={{ color: focusTheme.text }}>Interrompere l'allenamento?</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: focusTheme.textSecondary }}>Hai completato {getTotalCompletedSets()} serie. I dati non salvati andranno persi.</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmQuitDialog(false)} sx={{ color: focusTheme.textSecondary }}>Continua</Button>
              <Button onClick={confirmQuit} sx={{ color: focusTheme.primary }}>Esci</Button>
            </DialogActions>
          </Dialog>
        </Box>
      );
    }

    if (phase === 'summary') {
      const totalSets = getTotalCompletedSets();
      const exercisesCompleted = Object.keys(completedSets).length;
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: focusTheme.bg, color: focusTheme.text }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${focusTheme.border}` }}>
            <IconButton onClick={handleQuit} sx={{ color: focusTheme.textSecondary }}><ArrowBackIcon /></IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1 }}>RIEPILOGO</Typography>
          </Box>

          <Container maxWidth="sm" sx={{ py: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <TrophyIcon sx={{ fontSize: 56, color: focusTheme.warning, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Allenamento Completato!</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: focusTheme.primary }}>{exercisesCompleted}</Typography>
                  <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>ESERCIZI</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: focusTheme.primary }}>{totalSets}</Typography>
                  <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>SERIE</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: focusTheme.primary, fontFamily: 'monospace' }}>{getElapsedTime()}</Typography>
                  <Typography variant="caption" sx={{ color: focusTheme.textMuted }}>DURATA</Typography>
                </Box>
              </Box>
            </Box>

            <Paper sx={{ bgcolor: focusTheme.bgCard, borderRadius: 3, overflow: 'hidden', mb: 3, border: `1px solid ${focusTheme.border}` }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: focusTheme.bgElevated }}>
                <Typography variant="subtitle2" sx={{ color: focusTheme.textMuted, letterSpacing: 1 }}>DETTAGLIO ESERCIZI</Typography>
              </Box>
              {selectedDay?.exercises?.map((exercise) => {
                const sets = completedSets[exercise.id];
                if (!sets || sets.length === 0) return null;
                return (
                  <Box key={exercise.id} sx={{ px: 2, py: 2, borderBottom: `1px solid ${focusTheme.border}` }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: focusTheme.text }}>{exercise.exercise_name}</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border, py: 0.5 }}>Serie</TableCell>
                            <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border, py: 0.5 }}>Peso</TableCell>
                            <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border, py: 0.5 }}>Reps</TableCell>
                            <TableCell sx={{ color: focusTheme.textMuted, borderColor: focusTheme.border, py: 0.5 }}>Tecnica</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sets.map((set) => (
                            <TableRow key={set.setNumber}>
                              <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border, py: 0.5 }}>{set.setNumber}</TableCell>
                              <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border, py: 0.5, fontWeight: 600 }}>{set.weight} kg</TableCell>
                              <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border, py: 0.5 }}>{set.reps}</TableCell>
                              <TableCell sx={{ color: focusTheme.text, borderColor: focusTheme.border, py: 0.5 }}>{set.intensity_technique || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                );
              })}
            </Paper>

            <TextField label="Note sull'allenamento (opzionale)" multiline rows={3} value={workoutNotes}
              onChange={(e) => setWorkoutNotes(e.target.value)} fullWidth placeholder="Come ti sei sentito? Qualcosa da ricordare?"
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: focusTheme.text, '& fieldset': { borderColor: focusTheme.border }, '&:hover fieldset': { borderColor: focusTheme.primary }, '&.Mui-focused fieldset': { borderColor: focusTheme.primary } }, '& .MuiInputLabel-root': { color: focusTheme.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: focusTheme.primary } }} />

            <Button variant="contained" fullWidth size="large"
              startIcon={saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <SaveIcon />}
              onClick={handleSave} disabled={saving || getTotalCompletedSets() === 0}
              sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, letterSpacing: 1, bgcolor: focusTheme.primary, color: '#fff', borderRadius: 3,
                boxShadow: '0 4px 20px rgba(229, 57, 53, 0.4)', '&:hover': { bgcolor: focusTheme.primaryDark },
                '&:disabled': { bgcolor: focusTheme.bgElevated, color: focusTheme.textMuted }, mb: 2 }}>
              {saving ? 'Salvataggio...' : 'Salva Allenamento'}
            </Button>

            <Button variant="text" fullWidth onClick={handleQuit} disabled={saving} sx={{ color: focusTheme.textMuted, py: 1.5 }}>Annulla</Button>
          </Container>

          <Dialog open={confirmQuitDialog} onClose={() => setConfirmQuitDialog(false)}
            PaperProps={{ sx: { bgcolor: focusTheme.bgCard, color: focusTheme.text, borderRadius: 3 } }}>
            <DialogTitle sx={{ color: focusTheme.text }}>Scartare l'allenamento?</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: focusTheme.textSecondary }}>Hai completato {getTotalCompletedSets()} serie. I dati non verranno salvati.</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmQuitDialog(false)} sx={{ color: focusTheme.textSecondary }}>Rimani</Button>
              <Button onClick={confirmQuit} sx={{ color: focusTheme.primary }}>Scarta ed Esci</Button>
            </DialogActions>
          </Dialog>
        </Box>
      );
    }

    // Fallback
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: focusTheme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: focusTheme.primary }} />
      </Box>
    );
  };

  return (
    <>
      {renderContent()}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default FocusWorkout;

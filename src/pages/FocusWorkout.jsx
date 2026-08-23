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
  Divider,
  GlobalStyles
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
  AccessTime as AccessTimeIcon,
  History as HistoryIcon,
  Share as ShareIcon,
  LocalFireDepartment as FireIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeModeContext';
import { useTheme } from '@mui/material/styles';
import { API_BASE_URL } from '../config';
import { hapticFeedback } from '../utils/vibration';
import { INTENSITY_TECHNIQUES } from '../components/ExerciseDialog';
import { buildExerciseHistoryIndex, detectPersonalRecords } from '../utils/workoutMetrics';
import { celebrate, celebratePR, celebrateStreak, celebrateLevelUp } from '../utils/celebrate';

const DRAFT_STORAGE_KEY = 'gym_focus_workout_draft';

const FocusWorkout = () => {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const theme = useTheme();
  const { mode } = useThemeMode();
  const isDarkMode = mode === 'dark';

  const colors = {
    bg: theme.palette.background.default,
    bgCard: theme.palette.background.paper,
    bgElevated: theme.palette.action.hover,
    primary: theme.palette.primary.main,
    primaryLight: theme.palette.primary.light,
    primaryDark: theme.palette.primary.dark,
    text: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    textMuted: isDarkMode ? '#757575' : '#9e9e9e',
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    border: theme.palette.divider,
    timerBg: isDarkMode ? 'rgba(213, 0, 0, 0.08)' : 'rgba(213, 0, 0, 0.04)',
    primaryAlpha: isDarkMode ? 'rgba(213, 0, 0, 0.15)' : 'rgba(213, 0, 0, 0.08)',
  };

  // ================================================
  // STATE
  // ================================================
  const [phase, setPhase] = useState('loading'); // loading | select_day | workout | rest_timer | summary | resume_prompt
  const [activePlan, setActivePlan] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  // Indice dello storico per esercizio (ultima sessione + record personali),
  // calcolato dallo storico allenamenti. Usato per il riferimento "Ultima volta"
  // e per il rilevamento dei record (PR) nel riepilogo.
  const [historyIndex, setHistoryIndex] = useState({});

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
  const [savedResult, setSavedResult] = useState(null); // streak flags after successful save
  const [shareTextOpen, setShareTextOpen] = useState(false);

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

      // Carica piano attivo, impostazioni e storico allenamenti in parallelo
      const [plansRes, userRes, historyRes] = await Promise.all([
        fetch(`${API_BASE_URL}api/workout/read_plans.php`, { method: 'GET', credentials: 'include' }),
        fetch(`${API_BASE_URL}api/user/read.php`, { method: 'GET', credentials: 'include' }),
        fetch(`${API_BASE_URL}api/workout_history/read.php`, { method: 'GET', credentials: 'include' })
      ]);

      // Lo storico è opzionale: se manca (404 = nessun allenamento) o fallisce,
      // proseguiamo senza riferimenti/PR, senza bloccare il Focus Mode.
      try {
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistoryIndex(buildExerciseHistoryIndex(historyData.records || []));
        }
      } catch (e) {
        console.warn('Storico non disponibile per i riferimenti:', e);
      }

      if (!plansRes.ok) {
        let errorMessage = `Errore caricamento piani (${plansRes.status})`;
        try {
          const errorData = await plansRes.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Se non è JSON, prova a leggere come testo
          const errorText = await plansRes.text().catch(() => '');
          console.error('Risposta non-JSON dai piani:', errorText);
        }
        throw new Error(errorMessage);
      }
      
      if (!userRes.ok) {
        let errorMessage = `Errore caricamento utente (${userRes.status})`;
        try {
          const errorData = await userRes.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          const errorText = await userRes.text().catch(() => '');
          console.error('Risposta non-JSON dall\'utente:', errorText);
        }
        throw new Error(errorMessage);
      }

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
      setSnackbar({ open: true, message: 'Errore nel caricamento dei dati: ' + error.message, severity: 'error' });
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

  // ================================================
  // RIFERIMENTO ULTIMA SESSIONE (SOVRACCARICO PROGRESSIVO)
  // ================================================
  // Ritorna i set dell'ultima sessione registrata per l'esercizio (o null).
  // Match sul campo catalogo `exercise_id` (non `ex.id` che è il workout_exercise).
  const getLastSession = useCallback((exercise) => {
    if (!exercise) return null;
    const entry = historyIndex[exercise.exercise_id];
    return entry?.lastSession || null;
  }, [historyIndex]);

  // Peso suggerito = top set (peso più alto) dell'ultima sessione, come stringa.
  const getSuggestedWeight = useCallback((exercise) => {
    const last = getLastSession(exercise);
    if (!last || !Array.isArray(last.sets) || last.sets.length === 0) return '';
    const maxWeight = last.sets.reduce((m, s) => {
      const w = parseFloat(s.weight) || 0;
      return w > m ? w : m;
    }, 0);
    return maxWeight > 0 ? maxWeight.toString() : '';
  }, [getLastSession]);

  const handleStartWorkout = () => {
    if (!selectedDay || !selectedDay.exercises || selectedDay.exercises.length === 0) return;

    // Inizializza
    setCurrentExerciseIndex(0);
    setCurrentSetIndex(0);
    setCompletedSets({});
    setSkippedExercises([]);
    setWorkoutNotes('');
    setStartTime(new Date());

    // Pre-compila reps dal piano e peso dall'ultima sessione (sovraccarico progressivo)
    const firstExercise = selectedDay.exercises[0];
    setRepsInput(firstExercise.reps || '');
    setIntensityTechniqueInput(firstExercise.intensity_technique || '');
    setWeightInput(getSuggestedWeight(firstExercise));

    setPhase('workout');
    hapticFeedback.medium();
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

    hapticFeedback.success();

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
        setWeightInput(getSuggestedWeight(nextExercise));
        setExerciseTransition(true);
      }, 200);
    }
  }, [currentExerciseIndex, totalExercises, skippedExercises, selectedDay, getSuggestedWeight]);

  const handleSkipExercise = () => {
    setSkippedExercises(prev => [...prev, currentExerciseIndex]);
    goToNextExercise();
  };

  // Feedback aptico extra quando si entra nel riepilogo con almeno un record personale
  useEffect(() => {
    if (phase !== 'summary' || !selectedDay) return;
    const hasPR = selectedDay.exercises?.some((ex) => {
      const sets = completedSets[ex.id];
      if (!sets || sets.length === 0) return false;
      return detectPersonalRecords(sets, historyIndex[ex.exercise_id]).isPR;
    });
    if (hasPR) {
      hapticFeedback.success();
      celebratePR();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
          hapticFeedback.warning();
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
          notes: workoutNotes || '',
          start_time: startTime ? startTime.toISOString() : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante il salvataggio');
      }

      clearDraft();
      setSavedResult(data);

      // Streak/milestone celebration
      if (data.week_completed_now || data.new_longest || data.streak_milestone) {
        hapticFeedback.success();
        celebrateStreak();
      }

      // Level-up + achievement celebration (unified to avoid snackbar overwrite)
      if (data.leveled_up) {
        celebrateLevelUp();
      } else if (data.unlocked_achievements?.length) {
        celebrate();
      }

      const notifyParts = [];
      if (data.leveled_up) notifyParts.push(`Livello ${data.new_level} raggiunto! 🎉`);
      if (data.unlocked_achievements?.length) {
        notifyParts.push(`Achievement: ${data.unlocked_achievements.map(a => a.label).join(', ')}`);
      }
      if (notifyParts.length) {
        setSnackbar({ open: true, message: notifyParts.join(' · '), severity: 'success' });
      }

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
          minHeight: '100vh', bgcolor: colors.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <CircularProgress sx={{ color: colors.primary }} />
        </Box>
      );
    }

    if (phase === 'resume_prompt' && draftToResume) {
      return (
        <Box sx={{ 
          minHeight: '100vh', bgcolor: colors.bg, color: colors.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3
        }}>
          <Paper sx={{
            bgcolor: colors.bgCard, p: 4, maxWidth: 400, textAlign: 'center',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <HistoryIcon sx={{ fontSize: 64, color: colors.warning, mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Allenamento in sospeso
            </Typography>
            <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 1 }}>
              Hai un allenamento non salvato per il giorno:
            </Typography>
            <Typography variant="h6" sx={{ color: colors.primaryLight, fontWeight: 600, mb: 1 }}>
              {draftToResume.selectedDay?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textMuted, mb: 4 }}>
              Iniziato il {new Date(draftToResume.startTime).toLocaleString('it-IT')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleResumeDraft}
                sx={{
                  bgcolor: colors.primary, py: 1.5, fontWeight: 700,
                  '&:hover': { bgcolor: colors.primaryDark }
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
                  color: colors.textSecondary, borderColor: colors.border, py: 1.5,
                  '&:hover': { borderColor: colors.primary, color: colors.primaryLight }
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
        <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text }}>
          <Box sx={{
            px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.25,
            borderBottom: `1px solid ${colors.border}`
          }}>
            <IconButton onClick={() => navigate('/')} sx={{ color: colors.text }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{
              width: 26, height: 26, borderRadius: '7px', bgcolor: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FitnessCenterIcon sx={{ color: '#fff', fontSize: 15 }} />
            </Box>
            <Typography sx={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: '0.06em' }}>
              FOCUS MODE
            </Typography>
          </Box>

          <Container maxWidth="sm" sx={{ py: 4 }}>
            {!activePlan ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <FitnessCenterIcon sx={{ fontSize: 64, color: colors.textMuted, mb: 2 }} />
                <Typography variant="h6" sx={{ color: colors.textSecondary, mb: 2 }}>
                  Nessun piano attivo
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textMuted, mb: 3 }}>
                  Vai alle Schede e attiva un piano di allenamento
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/workouts?tab=plans')}
                  sx={{ color: colors.primary, borderColor: colors.primary }}
                >
                  Vai alle Schede
                </Button>
              </Box>
            ) : (
              <>
                <Paper sx={{
                  bgcolor: colors.bgCard, p: 3, mb: 3,
                  border: `1px solid ${colors.border}`
                }}>
                  <Typography variant="overline" sx={{ color: colors.textMuted, letterSpacing: 2 }}>
                    Piano attivo
                  </Typography>
                  <Typography variant="h5" sx={{ color: colors.text, fontWeight: 700, mb: 3 }}>
                    {activePlan.name}
                  </Typography>

                  <FormControl fullWidth sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      color: colors.text,
                      '& fieldset': { borderColor: colors.border },
                      '&:hover fieldset': { borderColor: colors.primary },
                      '&.Mui-focused fieldset': { borderColor: colors.primary },
                    },
                    '& .MuiInputLabel-root': { color: colors.textSecondary },
                    '& .MuiInputLabel-root.Mui-focused': { color: colors.primary },
                    '& .MuiSvgIcon-root': { color: colors.textSecondary },
                  }}>
                    <InputLabel>Seleziona Giorno</InputLabel>
                    <Select
                      value={selectedDayId}
                      label="Seleziona Giorno"
                      onChange={handleDayChange}
                    >
                      {activePlan.days?.map((day) => (
                        <MenuItem key={day.id} value={day.id}>{day.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedDay && selectedDay.exercises && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: colors.textMuted, mb: 1.5, letterSpacing: 1 }}>
                        ESERCIZI ({selectedDay.exercises.length})
                      </Typography>
                      {selectedDay.exercises.map((ex, idx) => (
                        <Box key={ex.id} sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          py: 1.5, borderBottom: idx < selectedDay.exercises.length - 1 ? `1px solid ${colors.border}` : 'none'
                        }}>
                          <Box>
                            <Typography variant="body1" sx={{ color: colors.text, fontWeight: 500 }}>
                              {ex.exercise_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: colors.textMuted }}>
                              {ex.sets} serie × {ex.reps} — Recupero: {ex.rest}s
                              {ex.intensity_technique && ` — ${ex.intensity_technique}`}
                            </Typography>
                          </Box>
                          <Chip
                            label={ex.muscle_group}
                            size="small"
                            sx={{
                              bgcolor: colors.primaryAlpha,
                              color: colors.primaryLight,
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
                    bgcolor: colors.primary, color: '#fff', borderRadius: '14px', textTransform: 'uppercase',
                    boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(213, 0, 0, 0.2)',
                    '&:hover': { bgcolor: colors.primaryDark, boxShadow: isDarkMode ? '0 6px 24px rgba(0, 0, 0, 0.5)' : '0 6px 24px rgba(213, 0, 0, 0.3)', transform: 'translateY(-2px)' },
                    '&:disabled': { bgcolor: colors.bgElevated, color: colors.textMuted },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Inizia Allenamento
                </Button>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2, gap: 1 }}>
                  {timerEnabled ? (
                    <>
                      <TimerIcon sx={{ fontSize: 16, color: colors.success }} />
                      <Typography variant="caption" sx={{ color: colors.textMuted }}>Timer di recupero attivo</Typography>
                    </>
                  ) : (
                    <>
                      <TimerOffIcon sx={{ fontSize: 16, color: colors.textMuted }} />
                      <Typography variant="caption" sx={{ color: colors.textMuted }}>Timer di recupero disattivato</Typography>
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
          minHeight: '100vh', bgcolor: colors.bg, color: colors.text,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3
        }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
            <CircularProgress variant="determinate" value={progress} size={220} thickness={4}
              sx={{ color: colors.primary, '& .MuiCircularProgress-circle': { strokeLinecap: 'round', transition: 'stroke-dashoffset 1s linear' } }} />
            <CircularProgress variant="determinate" value={100} size={220} thickness={4}
              sx={{ color: colors.border, position: 'absolute', left: 0, zIndex: 0 }} />
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Typography variant="h2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: colors.text }}>{formatTime(timerRemaining)}</Typography>
              <Typography variant="caption" sx={{ color: colors.textMuted, mt: 0.5 }}>RECUPERO</Typography>
            </Box>
          </Box>
          <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 1 }}>{currentExercise?.exercise_name}</Typography>
          <Typography variant="body2" sx={{ color: colors.textMuted, mb: 4 }}>Prossima: Serie {currentSetIndex + 1} di {totalSetsForCurrentExercise}</Typography>
          <Button variant="outlined" size="large" startIcon={<SkipNextIcon />} onClick={handleSkipTimer}
            sx={{ color: colors.text, borderColor: colors.border, borderRadius: '12px', px: 4, py: 1.5, fontSize: '1rem',
              '&:hover': { borderColor: colors.primary, bgcolor: colors.timerBg } }}>
            Salta Timer
          </Button>
        </Box>
      );
    }

    if (phase === 'workout' && currentExercise) {
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}` }}>
            <IconButton onClick={handleQuit} sx={{ color: colors.textSecondary }}><CloseIcon /></IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 16, color: colors.textMuted }} />
              <Typography variant="caption" sx={{ color: colors.textMuted, fontFamily: 'monospace' }}>{getElapsedTime()}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: colors.textMuted }}>{currentExerciseIndex + 1}/{totalExercises}</Typography>
          </Box>

          <LinearProgress variant="determinate" value={((currentExerciseIndex) / totalExercises) * 100}
            sx={{ height: 3, bgcolor: colors.border, '& .MuiLinearProgress-bar': { bgcolor: colors.primary } }} />

          <Fade in={exerciseTransition} timeout={300}>
            <Container maxWidth="sm" sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Chip label={currentExercise.muscle_group} size="small" sx={{ bgcolor: colors.primaryAlpha, color: colors.primaryLight, mb: 1, fontWeight: 500 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>{currentExercise.exercise_name}</Typography>
                {currentExercise.notes && (
                  <Alert severity="info" icon={<InfoIcon sx={{ color: colors.primaryLight }} />}
                    sx={{ mt: 2, bgcolor: colors.timerBg, color: colors.textSecondary, '& .MuiAlert-icon': { color: colors.primaryLight }, border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
                    {currentExercise.notes}
                  </Alert>
                )}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 3 }}>
                {Array(totalSetsForCurrentExercise).fill(null).map((_, idx) => (
                  <Box key={idx} sx={{
                    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${idx < currentSetIndex ? colors.success : idx === currentSetIndex ? colors.primary : colors.border}`,
                    bgcolor: idx < currentSetIndex ? colors.success : 'transparent',
                    color: idx < currentSetIndex ? '#fff' : idx === currentSetIndex ? colors.primary : colors.textMuted,
                    fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.3s ease'
                  }}>
                    {idx < currentSetIndex ? <CheckIcon sx={{ fontSize: 18 }} /> : idx + 1}
                  </Box>
                ))}
              </Box>

              <Typography variant="subtitle2" sx={{ textAlign: 'center', color: colors.textMuted, mb: 3, letterSpacing: 1 }}>
                SERIE {currentSetIndex + 1} DI {totalSetsForCurrentExercise}
              </Typography>

              {(() => {
                const last = getLastSession(currentExercise);
                if (!last || !Array.isArray(last.sets) || last.sets.length === 0) return null;
                const summary = last.sets
                  .map(s => `${parseFloat(s.weight)}kg×${s.reps}`)
                  .join('  ·  ');
                return (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5, py: 1,
                    borderRadius: '10px', bgcolor: colors.bgElevated, border: `1px solid ${colors.border}`
                  }}>
                    <HistoryIcon sx={{ fontSize: 18, color: colors.textMuted }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: colors.textMuted, letterSpacing: 0.5 }}>
                        ULTIMA VOLTA
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                        {summary}
                      </Typography>
                    </Box>
                  </Box>
                );
              })()}

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField label="Peso (kg)" type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
                  fullWidth autoFocus inputProps={{ step: 0.5, min: 0, inputMode: 'decimal' }}
                  sx={{ '& .MuiOutlinedInput-root': { color: colors.text, fontSize: '1.2rem', fontWeight: 700, '& fieldset': { borderColor: colors.border, borderWidth: 2 }, '&:hover fieldset': { borderColor: colors.primary }, '&.Mui-focused fieldset': { borderColor: colors.primary } }, '& .MuiInputLabel-root': { color: colors.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: colors.primary } }} />
                <TextField label="Ripetizioni" value={repsInput} onChange={(e) => setRepsInput(e.target.value)}
                  fullWidth inputProps={{ inputMode: 'text' }}
                  sx={{ '& .MuiOutlinedInput-root': { color: colors.text, fontSize: '1.2rem', fontWeight: 700, '& fieldset': { borderColor: colors.border, borderWidth: 2 }, '&:hover fieldset': { borderColor: colors.primary }, '&.Mui-focused fieldset': { borderColor: colors.primary } }, '& .MuiInputLabel-root': { color: colors.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: colors.primary } }} />
              </Box>

              <FormControl fullWidth sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  color: colors.text,
                  '& fieldset': { borderColor: colors.border, borderWidth: 2 },
                  '&:hover fieldset': { borderColor: colors.primary },
                  '&.Mui-focused fieldset': { borderColor: colors.primary },
                },
                '& .MuiInputLabel-root': { color: colors.textSecondary },
                '& .MuiInputLabel-root.Mui-focused': { color: colors.primary },
                '& .MuiSvgIcon-root': { color: colors.textSecondary },
              }}>
                <InputLabel>Tecnica di Intensità</InputLabel>
                <Select
                  value={intensityTechniqueInput}
                  label="Tecnica di Intensità"
                  onChange={(e) => setIntensityTechniqueInput(e.target.value)}
                >
                  <MenuItem value=""><em>Nessuna</em></MenuItem>
                  {INTENSITY_TECHNIQUES.filter(t => t !== 'Nessuna (Normale)').map((tech) => (
                    <MenuItem key={tech} value={tech}>{tech}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button variant="contained" fullWidth size="large" startIcon={<CheckIcon />} onClick={handleConfirmSet} disabled={!weightInput || !repsInput}
                sx={{ py: 2.5, fontSize: '1.2rem', fontWeight: 700, letterSpacing: 1, bgcolor: colors.success, color: '#fff', borderRadius: '14px',
                  boxShadow: '0 4px 16px rgba(76, 175, 80, 0.3)', '&:hover': { bgcolor: 'success.dark', boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4)' },
                  '&:disabled': { bgcolor: colors.bgElevated, color: colors.textMuted }, mb: 2, transition: 'all 0.3s ease' }}>
                Conferma Serie
              </Button>

              <Button variant="text" fullWidth startIcon={<SkipNextIcon />} onClick={handleSkipExercise}
                sx={{ py: 1.5, color: colors.textMuted, '&:hover': { color: colors.textSecondary, bgcolor: 'rgba(255,255,255,0.05)' }, mb: 3 }}>
                Salta Esercizio
              </Button>

              {currentExerciseSets.length > 0 && (
                <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                  <Box sx={{ px: 2, py: 1.5, bgcolor: colors.bgElevated }}>
                    <Typography variant="subtitle2" sx={{ color: colors.textMuted, letterSpacing: 1 }}>SERIE COMPLETATE</Typography>
                  </Box>
                  {currentExerciseSets.map((set, idx) => (
                    <Box key={set.setNumber} sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      px: 2, py: 1.25, borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none',
                    }}>
                      <Typography variant="body2" sx={{ color: colors.textMuted }}>Serie {set.setNumber}</Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ color: colors.text, fontWeight: 600 }}>{set.weight} kg × {set.reps}</Typography>
                        {set.intensity_technique && (
                          <Typography variant="caption" sx={{ color: colors.textMuted, display: 'block' }}>{set.intensity_technique}</Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Paper>
              )}
            </Container>
          </Fade>

          <Dialog open={confirmQuitDialog} onClose={() => setConfirmQuitDialog(false)}
            PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: '16px' } }}>
            <DialogTitle sx={{ color: colors.text }}>Interrompere l'allenamento?</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: colors.textSecondary }}>Hai completato {getTotalCompletedSets()} serie. I dati non salvati andranno persi.</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmQuitDialog(false)} sx={{ color: colors.textSecondary }}>Continua</Button>
              <Button onClick={confirmQuit} sx={{ color: colors.primary }}>Esci</Button>
            </DialogActions>
          </Dialog>
        </Box>
      );
    }

    if (phase === 'summary') {
      const totalSets = getTotalCompletedSets();
      const exercisesCompleted = Object.keys(completedSets).length;
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, color: colors.text }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${colors.border}` }}>
            <IconButton onClick={handleQuit} sx={{ color: colors.textSecondary }}><ArrowBackIcon /></IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1 }}>RIEPILOGO</Typography>
          </Box>

          <Container maxWidth="sm" sx={{ py: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <TrophyIcon sx={{ fontSize: 56, color: colors.warning, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Allenamento Completato!</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: colors.primary }}>{exercisesCompleted}</Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted }}>ESERCIZI</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: colors.primary }}>{totalSets}</Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted }}>SERIE</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: colors.primary, fontFamily: 'monospace' }}>{getElapsedTime()}</Typography>
                  <Typography variant="caption" sx={{ color: colors.textMuted }}>DURATA</Typography>
                </Box>
              </Box>
            </Box>

            <Paper sx={{ bgcolor: colors.bgCard, overflow: 'hidden', mb: 3, border: `1px solid ${colors.border}` }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: colors.bgElevated }}>
                <Typography variant="subtitle2" sx={{ color: colors.textMuted, letterSpacing: 1 }}>DETTAGLIO ESERCIZI</Typography>
              </Box>
              {selectedDay?.exercises?.map((exercise) => {
                const sets = completedSets[exercise.id];
                if (!sets || sets.length === 0) return null;
                // Confronto con lo storico PRIMA di questa sessione → record personali
                const pr = detectPersonalRecords(sets, historyIndex[exercise.exercise_id]);
                const prParts = [];
                if (pr.weight) prParts.push('peso');
                if (pr.oneRM) prParts.push('1RM');
                if (pr.volume) prParts.push('volume');
                return (
                  <Box key={exercise.id} sx={{ px: 2, py: 2, borderBottom: `1px solid ${colors.border}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: colors.text }}>{exercise.exercise_name}</Typography>
                      {pr.isPR && (
                        <Chip
                          icon={<TrophyIcon sx={{ fontSize: 16, color: `${colors.warning} !important` }} />}
                          label={`Nuovo record${prParts.length ? ` (${prParts.join(', ')})` : ''}`}
                          size="small"
                          sx={{ bgcolor: 'rgba(255, 167, 38, 0.15)', color: colors.warning, fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {sets.map((set) => (
                        <Box key={set.setNumber} sx={{
                          bgcolor: colors.bgElevated, borderRadius: '6px', px: 1.125, py: 0.625,
                          fontSize: 12, fontWeight: 600, color: colors.textSecondary,
                        }}>
                          {set.weight}kg×{set.reps}{set.intensity_technique ? ` · ${set.intensity_technique}` : ''}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </Paper>

            {savedResult ? (
              <>
                {/* Streak banner */}
                {(savedResult.week_completed_now || savedResult.streak_milestone || savedResult.new_longest) && (
                  <Paper sx={{
                    bgcolor: isDarkMode ? 'rgba(213, 0, 0, 0.12)' : 'rgba(213, 0, 0, 0.06)',
                    border: `1px solid ${colors.primary}`,
                    p: 2.5, mb: 3, textAlign: 'center'
                  }}>
                    <FireIcon sx={{ fontSize: 40, color: colors.primary, mb: 0.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary }}>
                      {savedResult.new_longest
                        ? `Nuovo record! 🏆 ${savedResult.current_streak_weeks} settimane consecutive`
                        : savedResult.streak_milestone && savedResult.current_streak_weeks > 1
                          ? `${savedResult.current_streak_weeks} settimane di fila! 🔥`
                          : 'Settimana completata! 🔥'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                      Streak: {savedResult.current_streak_weeks} {savedResult.current_streak_weeks === 1 ? 'settimana' : 'settimane'}
                    </Typography>
                  </Paper>
                )}

                {/* Recap card */}
                {(() => {
                  const prList = selectedDay?.exercises
                    ?.filter(ex => {
                      const sets = completedSets[ex.id];
                      return sets?.length && detectPersonalRecords(sets, historyIndex[ex.exercise_id]).isPR;
                    })
                    .map(ex => ex.exercise_name) || [];

                  const handleShare = async () => {
                    const date = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
                    const lines = [
                      `🏋️ Allenamento del ${date}`,
                      `${activePlan?.name || ''}${selectedDay?.name ? ' · ' + selectedDay.name : ''}`,
                      `⏱ ${getElapsedTime()} · ${exercisesCompleted} esercizi · ${totalSets} serie`,
                    ];
                    if (prList.length) lines.push(`🏆 Nuovi record: ${prList.join(', ')}`);
                    if (savedResult.current_streak_weeks > 0) lines.push(`🔥 Streak: ${savedResult.current_streak_weeks} settimane`);
                    lines.push('', 'Tracciato con Gym Progress Tracker');
                    const text = lines.join('\n');

                    if (navigator.share) {
                      try { await navigator.share({ title: 'Il mio allenamento', text }); } catch (_) {}
                    } else if (navigator.clipboard) {
                      await navigator.clipboard.writeText(text);
                      setSnackbar({ open: true, message: 'Copiato negli appunti!', severity: 'success' });
                    } else {
                      setShareTextOpen(true);
                    }
                  };

                  return (
                    <Paper sx={{ bgcolor: colors.bgCard, border: `1px solid ${colors.border}`, p: 2.5, mb: 3 }}>
                      <Typography variant="subtitle2" sx={{ color: colors.textMuted, mb: 1.5, letterSpacing: 1 }}>
                        RIEPILOGO SESSIONE
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                        {activePlan?.name}{selectedDay?.name ? ` · ${selectedDay.name}` : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                        ⏱ {getElapsedTime()} · {exercisesCompleted} esercizi · {totalSets} serie
                      </Typography>
                      {prList.length > 0 && (
                        <Typography variant="body2" sx={{ color: colors.warning, mb: 0.5 }}>
                          🏆 Nuovi record: {prList.join(', ')}
                        </Typography>
                      )}
                      {savedResult.current_streak_weeks > 0 && (
                        <Typography variant="body2" sx={{ color: colors.primary }}>
                          🔥 Streak: {savedResult.current_streak_weeks} settimane
                        </Typography>
                      )}
                      <Button
                        variant="outlined" fullWidth size="small"
                        startIcon={<ShareIcon />}
                        onClick={handleShare}
                        sx={{ mt: 2, borderColor: colors.border, color: colors.textSecondary }}
                      >
                        Condividi
                      </Button>
                    </Paper>
                  );
                })()}

                <Button
                  variant="contained" fullWidth size="large"
                  onClick={() => navigate('/workouts?tab=history', { state: { refreshHistory: Date.now() } })}
                  sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, letterSpacing: 1, bgcolor: colors.primary, color: '#fff', borderRadius: '14px', mb: 2 }}
                >
                  Vai alla Cronologia
                </Button>

                <Button variant="text" fullWidth onClick={() => navigate('/')} sx={{ color: colors.textMuted, py: 1.5 }}>
                  Torna alla Home
                </Button>

                {/* Fallback share dialog */}
                <Dialog open={shareTextOpen} onClose={() => setShareTextOpen(false)}
                  PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: '16px' } }}>
                  <DialogTitle>Copia il testo</DialogTitle>
                  <DialogContent>
                    <TextField
                      multiline fullWidth variant="outlined" InputProps={{ readOnly: true }}
                      value={[
                        `🏋️ Allenamento del ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`,
                        `${activePlan?.name || ''}${selectedDay?.name ? ' · ' + selectedDay.name : ''}`,
                        `⏱ ${getElapsedTime()} · ${exercisesCompleted} esercizi · ${totalSets} serie`,
                        ...(savedResult.current_streak_weeks > 0 ? [`🔥 Streak: ${savedResult.current_streak_weeks} settimane`] : []),
                        '', 'Tracciato con Gym Progress Tracker'
                      ].join('\n')}
                      sx={{ '& .MuiOutlinedInput-root': { color: colors.text, '& fieldset': { borderColor: colors.border } } }}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setShareTextOpen(false)} sx={{ color: colors.primary }}>Chiudi</Button>
                  </DialogActions>
                </Dialog>
              </>
            ) : (
              <>
                <TextField label="Note sull'allenamento (opzionale)" multiline rows={3} value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)} fullWidth placeholder="Come ti sei sentito? Qualcosa da ricordare?"
                  sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: colors.text, '& fieldset': { borderColor: colors.border }, '&:hover fieldset': { borderColor: colors.primary }, '&.Mui-focused fieldset': { borderColor: colors.primary } }, '& .MuiInputLabel-root': { color: colors.textSecondary }, '& .MuiInputLabel-root.Mui-focused': { color: colors.primary } }} />

                <Button variant="contained" fullWidth size="large"
                  startIcon={saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <SaveIcon />}
                  onClick={handleSave} disabled={saving || getTotalCompletedSets() === 0}
                  sx={{ py: 2, fontSize: '1.1rem', fontWeight: 700, letterSpacing: 1, bgcolor: colors.primary, color: '#fff', borderRadius: '14px',
                    boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(213, 0, 0, 0.2)', '&:hover': { bgcolor: colors.primaryDark },
                    '&:disabled': { bgcolor: colors.bgElevated, color: colors.textMuted }, mb: 2 }}>
                  {saving ? 'Salvataggio...' : 'Salva Allenamento'}
                </Button>

                <Button variant="text" fullWidth onClick={handleQuit} disabled={saving} sx={{ color: colors.textMuted, py: 1.5 }}>Annulla</Button>
              </>
            )}
          </Container>

          <Dialog open={confirmQuitDialog} onClose={() => setConfirmQuitDialog(false)}
            PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: '16px' } }}>
            <DialogTitle sx={{ color: colors.text }}>Scartare l'allenamento?</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: colors.textSecondary }}>Hai completato {getTotalCompletedSets()} serie. I dati non verranno salvati.</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmQuitDialog(false)} sx={{ color: colors.textSecondary }}>Rimani</Button>
              <Button onClick={confirmQuit} sx={{ color: colors.primary }}>Scarta ed Esci</Button>
            </DialogActions>
          </Dialog>
        </Box>
      );
    }

    // Fallback
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  };
  return (
    <>
    <GlobalStyles styles={{
      '.MuiPaper-root.MuiMenu-paper': {
        backgroundColor: `${colors.bgCard} !important`,
        color: `${colors.text} !important`,
        border: `1px solid ${colors.border} !important`,
        boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.15)',
      },
      '.MuiMenuItem-root': {
        color: `${colors.text} !important`,
      },
      '.MuiMenuItem-root:hover': {
        backgroundColor: isDarkMode ? 'rgba(229, 57, 53, 0.2) !important' : 'rgba(213, 0, 0, 0.1) !important',
      },
      '.MuiTypography-root': {
        color: 'inherit',
      }
    }} />
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
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default FocusWorkout;

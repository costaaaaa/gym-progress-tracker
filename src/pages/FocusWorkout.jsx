import { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Fade,
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
  Info as InfoIcon,
  EmojiEvents as TrophyIcon,
  AccessTime as AccessTimeIcon,
  History as HistoryIcon,
  Share as ShareIcon,
  LocalFireDepartment as FireIcon,
  SwapHoriz as SwapIcon,
  Add as AddIcon,
  Lock as LockIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeModeContext';
import { useTheme } from '@mui/material/styles';
import { API_BASE_URL } from '../config';
import { hapticFeedback } from '../utils/vibration';
import { INTENSITY_TECHNIQUES } from '../components/ExerciseDialog';
import { buildExerciseHistoryIndex, detectPersonalRecords } from '../utils/workoutMetrics';
import { buildShareStats } from '../utils/shareCard';
import ShareCardDialog from '../components/ShareCardDialog';
import FocusExercisePicker from '../components/FocusExercisePicker';
import {
  FEATURE_SESSION_EDIT, lastSessionSets, setStatus, numberedSets,
  buildSessionEntry, swapExercise, insertExercise
} from '../utils/focusSession';
import { celebrate, celebratePR, celebrateStreak, celebrateLevelUp } from '../utils/celebrate';
import { usePageMeta } from '../hooks/usePageMeta';
import { track } from '../utils/analytics';
import { xpWithheldMessage } from '../utils/gamificationLevels';

const DRAFT_STORAGE_KEY = 'gym_focus_workout_draft';

const FocusWorkout = () => {
  usePageMeta(
    'Focus Mode',
    'Allenamento guidato con timer di recupero, storico "ultima volta" e rilevamento automatico dei record personali.'
  );
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
  // Serie saltate per voce di sessione: { [ex.id]: [indice serie, ...] }
  const [skippedSets, setSkippedSets] = useState({});
  // Funzioni premium abilitate (user/read.php → features): qui solo per mostrare i comandi,
  // il salvataggio lo controlla record_workout.php
  const [features, setFeatures] = useState([]);
  // Picker esercizi: null = chiuso, altrimenti { mode: 'swap' | 'add', from: 'workout' | 'summary' }
  const [picker, setPicker] = useState(null);
  const [premiumDialog, setPremiumDialog] = useState(false);

  // Timer state
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const timerRef = useRef(null);

  // Summary state
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [startTime, setStartTime] = useState(null);
  // Fine allenamento, fissata all'arrivo nel riepilogo: la durata non cresce più mentre si scrivono le note
  const [endTime, setEndTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState(null); // streak flags after successful save
  const [shareStats, setShareStats] = useState(null); // card da condividere, null = dialog chiuso

  // UI state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmQuitDialog, setConfirmQuitDialog] = useState(false);
  const [exerciseTransition, setExerciseTransition] = useState(true);
  const [draftToResume, setDraftToResume] = useState(null);

  useEffect(() => {
    if (phase === 'summary') setEndTime((prev) => prev || new Date());
  }, [phase]);

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
        skippedSets,
        currentExerciseIndex,
        currentSetIndex,
        workoutNotes,
        startTime,
        phase: phase === 'rest_timer' ? 'workout' : phase, // Se crasha durante il timer, riprendi dall'esercizio
        timestamp: new Date().getTime()
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [phase, activePlan, selectedDay, selectedDayId, completedSets, skippedExercises, skippedSets, currentExerciseIndex, currentSetIndex, workoutNotes, startTime]);

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
  // useCallback([clearDraft]): non legge stato reattivo (solo localStorage,
  // setter e clearDraft, a sua volta stabile), quindi l'effetto sotto si
  // riesegue solo al cambio di isLoggedIn.
  const loadInitialData = useCallback(async () => {
    // Variabile locale, non lo stato `phase`: dopo gli await la closure
    // vedrebbe ancora 'loading' e sovrascriverebbe il prompt di ripresa con
    // 'select_day', facendo perdere la bozza. Stesso pattern del mobile
    // (FocusScreen.jsx).
    let resuming = false;
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
            resuming = true;
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
        } catch {
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
        } catch {
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
      setFeatures(Array.isArray(userData.features) ? userData.features : []);

      // Trova piano attivo
      if (plansData.records) {
        const active = plansData.records.find(p => p.is_active);
        if (active) {
          setActivePlan(active);
          // Se non c'è bozza, vai alla selezione giorno
          if (!resuming) {
            setPhase('select_day');
          }
        } else {
          setSnackbar({ open: true, message: 'Nessun piano attivo trovato. Attiva un piano dalle Schede.', severity: 'warning' });
          if (!resuming) {
            setPhase('select_day');
          }
        }
      } else {
        if (!resuming) {
          setPhase('select_day');
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento dati:', error);
      setSnackbar({ open: true, message: 'Errore nel caricamento dei dati: ' + error.message, severity: 'error' });
      if (!resuming) {
        setPhase('select_day');
      }
    }
  }, [clearDraft]);

  // Dopo la dichiarazione di loadInitialData: l'array di dipendenze viene
  // valutato durante il render (temporal dead zone se fosse sopra).
  useEffect(() => {
    if (isLoggedIn) {
      loadInitialData();
    }
  }, [isLoggedIn, loadInitialData]);

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
    setSkippedSets(draftToResume.skippedSets || {});
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
    setSkippedSets({});
    setWorkoutNotes('');
    setStartTime(new Date());
    setEndTime(null);

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
  const currentSkippedSets = skippedSets[currentExercise?.id] || [];
  const canEditSession = features.includes(FEATURE_SESSION_EDIT);

  // Porta il Focus su un esercizio: prima serie, reps e tecnica dal piano, peso dall'ultima sessione
  const enterExercise = useCallback((index, exercise) => {
    setCurrentExerciseIndex(index);
    setCurrentSetIndex(0);
    setRepsInput(exercise?.reps || '');
    setIntensityTechniqueInput(exercise?.intensity_technique || '');
    setWeightInput(getSuggestedWeight(exercise));
  }, [getSuggestedWeight]);

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
        enterExercise(nextIndex, selectedDay.exercises[nextIndex]);
        setExerciseTransition(true);
      }, 200);
    }
  }, [currentExerciseIndex, totalExercises, skippedExercises, selectedDay, enterExercise]);

  const handleSkipExercise = () => {
    setSkippedExercises(prev => [...prev, currentExerciseIndex]);
    goToNextExercise();
  };

  // Salta solo la serie corrente: non viene registrata e non parte il recupero.
  // Il peso già scritto resta, servirà per la serie dopo.
  const handleSkipSet = () => {
    if (currentSetIndex === 0) return;
    hapticFeedback.light();
    const exerciseId = currentExercise.id;
    setSkippedSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), currentSetIndex] }));
    const nextSetIndex = currentSetIndex + 1;
    if (nextSetIndex >= totalSetsForCurrentExercise) {
      goToNextExercise();
    } else {
      setCurrentSetIndex(nextSetIndex);
      setRepsInput(currentExercise.reps || '');
      setIntensityTechniqueInput(currentExercise.intensity_technique || '');
    }
  };

  // ================================================
  // CAMBIO / AGGIUNTA ESERCIZIO (premium, solo per questa sessione)
  // ================================================
  // Le modifiche vanno in selectedDay.exercises: bozza, salvataggio, riepilogo e
  // barra di avanzamento le vedono senza altro codice.
  const openPicker = (pickerMode, from = 'workout') => {
    if (!canEditSession) {
      setPremiumDialog(true);
      return;
    }
    if (pickerMode === 'swap' && currentSetIndex > 0) {
      setSnackbar({ open: true, message: "Puoi cambiare l'esercizio solo prima della prima serie", severity: 'info' });
      return;
    }
    setPicker({ mode: pickerMode, from });
  };

  const handlePickExercise = (catalogEx, opts) => {
    const exercises = selectedDay.exercises;
    if (picker.mode === 'swap') {
      const swapped = swapExercise(exercises, currentExerciseIndex, catalogEx);
      setSelectedDay({ ...selectedDay, exercises: swapped });
      enterExercise(currentExerciseIndex, swapped[currentExerciseIndex]);
      setSnackbar({ open: true, message: `Ora: ${catalogEx.name}`, severity: 'success' });
    } else {
      const entry = buildSessionEntry(catalogEx, opts);
      const fromSummary = picker.from === 'summary';
      const position = fromSummary || opts.position === 'end' ? exercises.length : currentExerciseIndex + 1;
      setSelectedDay({ ...selectedDay, exercises: insertExercise(exercises, position, entry) });
      if (fromSummary) {
        // Si torna ad allenarsi: la durata riparte (endTime era fissato all'arrivo nel riepilogo)
        setEndTime(null);
        enterExercise(position, entry);
        setPhase('workout');
      } else {
        setSnackbar({
          open: true,
          message: `${catalogEx.name} aggiunto ${opts.position === 'end' ? 'alla fine' : 'dopo questo esercizio'}`,
          severity: 'success'
        });
      }
    }
    hapticFeedback.medium();
    setPicker(null);
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
  const getElapsedSeconds = () => {
    if (!startTime) return 0;
    return Math.floor(((endTime || new Date()) - startTime) / 1000);
  };

  const getElapsedTime = () => {
    if (!startTime) return '00:00';
    const elapsed = getElapsedSeconds();
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

        // set_number consecutivi: le serie saltate non lasciano buchi
        numberedSets(sets).forEach(set => {
          workoutRecords.push({
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
            weight: set.weight,
            reps: set.reps,
            intensity_technique: set.intensity_technique,
            day_id: selectedDayId,
            set_number: set.set_number
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
          start_time: startTime ? startTime.toISOString() : null,
          duration_seconds: startTime ? getElapsedSeconds() : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante il salvataggio');
      }

      clearDraft();
      setSavedResult(data);
      track('workout_saved');
      if (data.total_sessions === 1) track('first_workout');

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
                {Array.from({ length: Number(totalSetsForCurrentExercise) || 0 }, (_, idx) => {
                  const status = setStatus(idx, currentSetIndex, currentSkippedSets);
                  return (
                    <Box key={idx} title={status === 'skipped' ? 'Serie saltata' : undefined} sx={{
                      width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px ${status === 'skipped' ? 'dashed' : 'solid'} ${status === 'done' ? colors.success : status === 'active' ? colors.primary : colors.border}`,
                      bgcolor: status === 'done' ? colors.success : status === 'skipped' ? colors.bgElevated : 'transparent',
                      color: status === 'done' ? '#fff' : status === 'active' ? colors.primary : colors.textMuted,
                      fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.3s ease'
                    }}>
                      {status === 'done' ? <CheckIcon sx={{ fontSize: 18 }} /> : status === 'skipped' ? <RemoveIcon sx={{ fontSize: 18 }} /> : idx + 1}
                    </Box>
                  );
                })}
              </Box>

              <Typography variant="subtitle2" sx={{ textAlign: 'center', color: colors.textMuted, mb: 3, letterSpacing: 1 }}>
                SERIE {currentSetIndex + 1} DI {totalSetsForCurrentExercise}
              </Typography>

              {(() => {
                const lastSets = lastSessionSets(getLastSession(currentExercise));
                if (lastSets.length === 0) return null;
                return (
                  <Box sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2, px: 1.5, py: 1,
                    borderRadius: '10px', bgcolor: colors.bgElevated, border: `1px solid ${colors.border}`
                  }}>
                    <HistoryIcon sx={{ fontSize: 18, color: colors.textMuted, mt: 0.25 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: colors.textMuted, letterSpacing: 0.5 }}>
                        ULTIMA VOLTA
                      </Typography>
                      {/* Una chip per serie, con la tecnica sotto; evidenziata quella pari alla serie in corso */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                        {lastSets.map((set, idx) => {
                          const isCurrent = idx === currentSetIndex;
                          return (
                            <Box key={idx} sx={{
                              px: 1, py: 0.5, borderRadius: '6px', bgcolor: colors.bgCard,
                              border: `1px solid ${isCurrent ? colors.primary : colors.border}`,
                            }}>
                              <Typography variant="body2" sx={{ color: isCurrent ? colors.text : colors.textSecondary, fontWeight: isCurrent ? 700 : 600, lineHeight: 1.3 }}>
                                {set.label}
                              </Typography>
                              {set.technique && (
                                <Typography variant="caption" sx={{ color: colors.primaryLight, display: 'block', lineHeight: 1.2, fontWeight: 600 }}>
                                  {set.technique}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
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

              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {/* Dalla seconda serie: saltare la prima equivale a saltare l'esercizio */}
                {currentSetIndex > 0 && (
                  <Button variant="text" fullWidth startIcon={<SkipNextIcon />} onClick={handleSkipSet}
                    sx={{ py: 1.5, color: colors.textMuted, '&:hover': { color: colors.textSecondary, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                    Salta Serie
                  </Button>
                )}
                <Button variant="text" fullWidth startIcon={<SkipNextIcon />} onClick={handleSkipExercise}
                  sx={{ py: 1.5, color: colors.textMuted, '&:hover': { color: colors.textSecondary, bgcolor: 'rgba(255,255,255,0.05)' } }}>
                  Salta Esercizio
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                {[
                  { mode: 'swap', label: 'Cambia', icon: <SwapIcon /> },
                  { mode: 'add', label: 'Aggiungi', icon: <AddIcon /> },
                ].map(({ mode: pickerMode, label, icon }) => (
                  <Button key={pickerMode} variant="outlined" fullWidth startIcon={icon}
                    endIcon={canEditSession ? null : <LockIcon sx={{ fontSize: '16px !important' }} />}
                    onClick={() => openPicker(pickerMode)}
                    sx={{ py: 1.25, opacity: pickerMode === 'swap' && currentSetIndex > 0 ? 0.45 : 1, color: colors.textSecondary, borderColor: colors.border, borderRadius: '12px',
                      '&:hover': { borderColor: colors.primary, color: colors.primaryLight } }}>
                    {label} esercizio
                  </Button>
                ))}
              </Box>

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
                      {exercise.replaces && (
                        <Typography variant="caption" sx={{ color: colors.textMuted }}>al posto di {exercise.replaces}</Typography>
                      )}
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

                {xpWithheldMessage(savedResult) && (
                  <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', mb: 2 }}>
                    {xpWithheldMessage(savedResult)}
                  </Typography>
                )}

                {/* Recap card */}
                {(() => {
                  const prList = selectedDay?.exercises
                    ?.filter(ex => {
                      const sets = completedSets[ex.id];
                      return sets?.length && detectPersonalRecords(sets, historyIndex[ex.exercise_id]).isPR;
                    })
                    .map(ex => ex.exercise_name) || [];

                  const handleShare = () => {
                    setShareStats(buildShareStats({
                      exercises: (selectedDay?.exercises || []).map(ex => ({ sets: completedSets[ex.id] || [] })),
                      date: startTime || new Date(),
                      durationSec: getElapsedSeconds(),
                      title: `${activePlan?.name || ''}${selectedDay?.name ? ' · ' + selectedDay.name : ''}`,
                      prNames: prList,
                      streakWeeks: savedResult.current_streak_weeks,
                    }));
                    track('workout_card', { action: 'open', from: 'summary' });
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

                <ShareCardDialog open={!!shareStats} stats={shareStats} onClose={() => setShareStats(null)} />
              </>
            ) : (
              <>
                {/* Esercizio dimenticato: si aggiunge in coda e si torna ad allenarsi */}
                <Button variant="outlined" fullWidth startIcon={<AddIcon />}
                  endIcon={canEditSession ? null : <LockIcon sx={{ fontSize: '16px !important' }} />}
                  onClick={() => openPicker('add', 'summary')}
                  sx={{ py: 1.25, mb: 3, color: colors.textSecondary, borderColor: colors.border, borderRadius: '12px',
                    '&:hover': { borderColor: colors.primary, color: colors.primaryLight } }}>
                  Aggiungi esercizio
                </Button>

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
      <FocusExercisePicker
        open={!!picker}
        mode={picker?.mode || 'add'}
        currentExercise={currentExercise}
        allowPosition={picker?.from !== 'summary'}
        onClose={() => setPicker(null)}
        onPick={handlePickExercise}
      />
      <Dialog open={premiumDialog} onClose={() => setPremiumDialog(false)}
        PaperProps={{ sx: { bgcolor: colors.bgCard, color: colors.text, borderRadius: '16px' } }}>
        <DialogTitle sx={{ color: colors.text, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ color: colors.warning }} /> Funzione Premium
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.textSecondary }}>
            Con Premium puoi cambiare un esercizio al volo (es. cavi occupati, passi ai manubri) o aggiungerne
            uno durante l'allenamento, anche per recuperare quello che hai saltato l'ultima volta.
            Nel frattempo puoi aggiungere l'esercizio alla tua scheda dalla sezione Schede.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPremiumDialog(false)} sx={{ color: colors.primary }}>Ho capito</Button>
        </DialogActions>
      </Dialog>
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

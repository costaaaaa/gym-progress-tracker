import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';
import { hapticFeedback } from '../../utils/vibration';
import { buildExerciseHistoryIndex, detectPersonalRecords } from '../../utils/workoutMetrics';
import {
  FEATURE_SESSION_EDIT, isValidWeight, suggestedWeight, slotWeight, totalSlots, setSlot, skipWarmup,
  isValidReps, repsNeedConfirm,
  numberedSets, buildSessionEntry, swapExercise, insertExercise,
  newIdempotencyKey, draftIdempotencyKey
} from '../../utils/focusSession';
import { celebrate, celebratePR, celebrateStreak, celebrateLevelUp } from '../../utils/celebrate';
import { track } from '../../utils/analytics';
import { currentTimeZone, moveToZoneDay, zoneClock } from '../../utils/workoutTime';
import i18n from '../../i18n';

const DRAFT_STORAGE_KEY = 'gym_focus_workout_draft';

// Stato e transizioni di Focus Mode (loading -> select_day o resume_prompt -> workout <-> rest_timer -> summary).
// Restituisce le props di ogni fase, come useFocusSession del mobile.
export default function useFocusSession() {
  const { t } = useTranslation();
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
  // Fuso del dispositivo quando l'allenamento è iniziato: la bozza lo porta con sé, così un viaggio fra l'inizio e il salvataggio non lo cambia
  const [timeZone, setTimeZone] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  // Fine allenamento: si fissa all'arrivo nel riepilogo (la durata non cresce più mentre si scrivono le note),
  // alla ripresa di una bozza ferma nel riepilogo e in «già finita». null: si sta ancora allenando
  // (in «già finita»: fine sconosciuta)
  const [endTime, setEndTime] = useState(null);
  // Tempo a pagina chiusa tra il riepilogo e "Riprendi": non è allenamento, la durata lo toglie
  const [pausedMs, setPausedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState(null); // streak flags after successful save
  const [shareStats, setShareStats] = useState(null); // card da condividere, null = dialog chiuso

  // UI state
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmQuitDialog, setConfirmQuitDialog] = useState(false);
  const [repsConfirmDialog, setRepsConfirmDialog] = useState(false);
  const [exerciseTransition, setExerciseTransition] = useState(true);
  const [draftToResume, setDraftToResume] = useState(null);
  // Una bozza di una versione vecchia non ha il fuso: vale quello di adesso
  const draftTimeZone = draftToResume ? draftToResume.timeZone || currentTimeZone() : null;
  // Orario dell'ultima serie registrata, o della ripresa dal riepilogo: fine reale di una sessione salvata
  // in ritardo. Mai prima dell'ultima pausa, così si può sottrarre pausedMs senza andare sotto l'inizio
  const [lastActivityAt, setLastActivityAt] = useState(null);
  // Giorno scelto (YYYY-MM-DD) per una bozza vecchia; null = salvataggio normale
  const [retroDate, setRetroDate] = useState(null);
  const [retroDateInput, setRetroDateInput] = useState('');

  useEffect(() => {
    if (phase === 'summary' && !retroDate) setEndTime((prev) => prev || new Date());
  }, [phase, retroDate]);

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
        timeZone,
        idempotencyKey,
        lastActivityAt,
        pausedMs,
        // Segno delle posizioni con riscaldamento: senza, currentSetIndex conta le sole serie allenanti
        warmupSlots: true,
        // Fine mostrata nel riepilogo, o fissa se già finita: la ripresa riparte da qui
        summaryEndAt: phase === 'summary' || retroDate ? endTime : null,
        phase: phase === 'rest_timer' ? 'workout' : phase, // Se crasha durante il timer, riprendi dall'esercizio
        timestamp: new Date().getTime()
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [phase, activePlan, selectedDay, selectedDayId, completedSets, skippedExercises, skippedSets, currentExerciseIndex, currentSetIndex, workoutNotes, startTime, timeZone, idempotencyKey, lastActivityAt, pausedMs, endTime, retroDate]);

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
        let errorMessage = i18n.t('focus.error_plans', { status: plansRes.status });
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
        let errorMessage = i18n.t('focus.error_user', { status: userRes.status });
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
          setSnackbar({ open: true, message: i18n.t('focus.no_active_plan_toast'), severity: 'warning' });
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
      setSnackbar({ open: true, message: i18n.t('focus.error_load', { message: error.message }), severity: 'error' });
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
  // Chiude la bozza vecchia come già finita: vai al riepilogo con il giorno scelto
  const handleResumeDraft = (finishedOn = null) => {
    if (!draftToResume) return;

    // Una bozza senza il segno è nata senza posizioni di riscaldamento: prosegue così
    const day = draftToResume.warmupSlots
      ? draftToResume.selectedDay
      : { ...draftToResume.selectedDay, exercises: draftToResume.selectedDay.exercises.map((e) => ({ ...e, warmup_sets: 0 })) };

    setActivePlan(draftToResume.activePlan);
    setSelectedDay(day);
    setSelectedDayId(draftToResume.selectedDayId);
    setCompletedSets(draftToResume.completedSets);
    setSkippedExercises(draftToResume.skippedExercises);
    setSkippedSets(draftToResume.skippedSets || {});
    setCurrentExerciseIndex(draftToResume.currentExerciseIndex);
    setCurrentSetIndex(draftToResume.currentSetIndex);
    setWorkoutNotes(draftToResume.workoutNotes);
    setStartTime(new Date(draftToResume.startTime));
    setTimeZone(draftTimeZone);
    setIdempotencyKey(draftIdempotencyKey(draftToResume));
    const lastActivity = draftToResume.lastActivityAt ? new Date(draftToResume.lastActivityAt) : null;
    setLastActivityAt(lastActivity);
    // Le bozze vecchie non hanno summaryEndAt: la fine è l'ultima serie
    const summaryEnd = draftToResume.summaryEndAt ? new Date(draftToResume.summaryEndAt) : lastActivity;
    let paused = draftToResume.pausedMs || 0;
    if (finishedOn) {
      setRetroDate(finishedOn);
      setEndTime(summaryEnd);
    } else if (draftToResume.phase === 'summary' && summaryEnd) {
      // Il tempo da quando si è chiusa a ora è una pausa; la durata riparte da qui
      const resumedAt = new Date();
      paused += Math.max(0, resumedAt - summaryEnd);
      setEndTime(resumedAt);
      setLastActivityAt(resumedAt);
    }
    setPausedMs(paused);

    // Ripristina input correnti
    const currentEx = day.exercises[draftToResume.currentExerciseIndex];
    setRepsInput('');
    setIntensityTechniqueInput(currentEx?.intensity_technique || '');

    setPhase(finishedOn ? 'summary' : (draftToResume.phase || 'workout'));
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

  // Peso suggerito = top set (peso più alto) delle serie allenanti dell'ultima sessione.
  const getSuggestedWeight = useCallback((exercise) => suggestedWeight(getLastSession(exercise)), [getLastSession]);

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
    setTimeZone(currentTimeZone());
    setIdempotencyKey(newIdempotencyKey());
    setEndTime(null);
    setPausedMs(0);
    setLastActivityAt(null);
    setRetroDate(null);

    // Peso dall'ultima sessione (sovraccarico progressivo); ripetizioni vuote, la scheda è in grigio
    const firstExercise = selectedDay.exercises[0];
    setRepsInput('');
    setIntensityTechniqueInput(firstExercise.intensity_technique || '');
    setWeightInput(slotWeight(firstExercise, 0, { suggested: getSuggestedWeight(firstExercise) }));

    setPhase('workout');
    hapticFeedback.medium();
  };

  // ================================================
  // ESERCIZIO CORRENTE
  // ================================================
  const currentExercise = selectedDay?.exercises?.[currentExerciseIndex];
  const totalExercises = selectedDay?.exercises?.length || 0;
  // Posizioni dell'esercizio: prima il riscaldamento della scheda, poi le serie allenanti
  const totalSlotsForCurrentExercise = currentExercise ? totalSlots(currentExercise) : 0;
  const currentSlot = currentExercise ? setSlot(currentExercise, currentSetIndex) : null;
  const currentExerciseSets = completedSets[currentExercise?.id] || [];
  // Il cambio esercizio vale finché non è stata fatta nessuna serie (riscaldamento compreso)
  const canSwap = currentExerciseSets.length === 0;
  const currentSkippedSets = skippedSets[currentExercise?.id] || [];
  const canEditSession = features.includes(FEATURE_SESSION_EDIT);

  // Porta il Focus su un esercizio: prima serie, tecnica dal piano, peso dall'ultima sessione.
  // Le ripetizioni partono vuote: la scheda è solo un suggerimento in grigio, da scrivere ogni volta.
  const enterExercise = useCallback((index, exercise) => {
    setCurrentExerciseIndex(index);
    setCurrentSetIndex(0);
    setRepsInput('');
    setIntensityTechniqueInput(exercise?.intensity_technique || '');
    setWeightInput(slotWeight(exercise, 0, { suggested: getSuggestedWeight(exercise) }));
  }, [getSuggestedWeight]);

  // ================================================
  // CONFERMA SERIE
  // ================================================
  const handleConfirmSet = () => {
    if (!isValidWeight(weightInput) || !isValidReps(repsInput)) return;
    if (repsNeedConfirm(repsInput, currentExercise.reps)) {
      setRepsConfirmDialog(true);
      return;
    }
    recordSet();
  };

  const recordSet = () => {
    setRepsConfirmDialog(false);
    hapticFeedback.success();

    const exerciseId = currentExercise.id;
    const { isWarmup } = currentSlot;
    const newSet = {
      setNumber: currentSetIndex + 1,
      weight: parseFloat(weightInput),
      reps: String(parseInt(repsInput, 10)),
      // Il riscaldamento non ha tecnica (il campo non c'è)
      intensity_technique: isWarmup ? '' : intensityTechniqueInput,
      is_warmup: isWarmup
    };

    setCompletedSets(prev => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] || []), newSet]
    }));
    setLastActivityAt(new Date());

    const nextSetIndex = currentSetIndex + 1;

    if (nextSetIndex >= totalSlotsForCurrentExercise) {
      // Tutte le serie completate per questo esercizio
      goToNextExercise();
    } else {
      // Prossima serie
      setCurrentSetIndex(nextSetIndex);
      setWeightInput(slotWeight(currentExercise, nextSetIndex, { suggested: getSuggestedWeight(currentExercise), current: weightInput }));
      setRepsInput('');
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
    // workingIndex è -1 in riscaldamento e 0 alla prima serie allenante (= salta esercizio)
    if (currentSlot.workingIndex < 1) return;
    hapticFeedback.light();
    const exerciseId = currentExercise.id;
    setSkippedSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), currentSetIndex] }));
    const nextSetIndex = currentSetIndex + 1;
    if (nextSetIndex >= totalSlotsForCurrentExercise) {
      goToNextExercise();
    } else {
      setCurrentSetIndex(nextSetIndex);
      setRepsInput('');
      setIntensityTechniqueInput(currentExercise.intensity_technique || '');
    }
  };

  // Salta le serie di riscaldamento rimaste: niente recupero, si riparte dalla prima serie allenante
  const handleSkipWarmup = () => {
    if (!currentSlot.isWarmup) return;
    hapticFeedback.light();
    const { skipped, nextIndex } = skipWarmup(currentExercise, currentSetIndex);
    setSkippedSets(prev => ({ ...prev, [currentExercise.id]: [...(prev[currentExercise.id] || []), ...skipped] }));
    setCurrentSetIndex(nextIndex);
    setWeightInput(slotWeight(currentExercise, nextIndex, { suggested: getSuggestedWeight(currentExercise) }));
    setRepsInput('');
    setIntensityTechniqueInput(currentExercise.intensity_technique || '');
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
    if (pickerMode === 'swap' && !canSwap) {
      setSnackbar({ open: true, message: t('focus.swap_only_first_set'), severity: 'info' });
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
      setSnackbar({ open: true, message: t('focus.swapped_to', { name: catalogEx.name }), severity: 'success' });
    } else {
      const entry = buildSessionEntry(catalogEx, opts);
      const fromSummary = picker.from === 'summary';
      const position = fromSummary || opts.position === 'end' ? exercises.length : currentExerciseIndex + 1;
      setSelectedDay({ ...selectedDay, exercises: insertExercise(exercises, position, entry) });
      if (fromSummary) {
        // Si torna ad allenarsi: la durata riparte (endTime vale finché si resta nel riepilogo).
        // Se è già finita la fine resta quella: le serie aggiunte non la spostano.
        if (!retroDate) setEndTime(null);
        enterExercise(position, entry);
        setPhase('workout');
      } else {
        setSnackbar({
          open: true,
          message: t(opts.position === 'end' ? 'focus.added_end' : 'focus.added_after', { name: catalogEx.name }),
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

  // Fine al netto delle pause: da qui si ricavano durata, riepilogo e fine salvata.
  // null: già finita con fine sconosciuta
  const netEnd = () => {
    const end = endTime || (retroDate ? null : new Date());
    return end ? end.getTime() - pausedMs : null;
  };

  // Inizio del cronometro in allenamento: l'inizio spostato delle pause, così riparte dalla durata già fatta
  const clockStart = startTime ? new Date(startTime.getTime() + pausedMs) : null;

  // Tempo totale allenamento
  const getElapsedSeconds = () => {
    const end = netEnd();
    if (!startTime || end === null) return 0;
    return Math.floor((end - startTime) / 1000);
  };

  const getElapsedTime = () => {
    if (!startTime) return '00:00';
    const elapsed = getElapsedSeconds();
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Inizio che si salva: con un giorno scelto è lo stesso orario del luogo, spostato su quel giorno
  const savedStart = startTime && retroDate ? new Date(moveToZoneDay(startTime, retroDate, timeZone)) : startTime;

  // Sessione salvata in ritardo: inizio e fine spostati sul giorno scelto, stesso orario e stessa durata
  const retroPayload = () => {
    const shift = savedStart.getTime() - startTime.getTime();
    const end = netEnd();
    return {
      backdated: true,
      time_zone: timeZone,
      start_time: savedStart.toISOString(),
      ended_at: end === null ? null : new Date(end + shift).toISOString(),
    };
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
            is_warmup: set.is_warmup,
            day_id: selectedDayId,
            set_number: set.set_number
          });
        });
      });

      if (workoutRecords.length === 0) {
        setSnackbar({ open: true, message: t('focus.nothing_to_save'), severity: 'warning' });
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
          idempotency_key: idempotencyKey,
          ...(retroDate ? retroPayload() : {
            time_zone: timeZone,
            start_time: startTime ? startTime.toISOString() : null,
            duration_seconds: startTime ? getElapsedSeconds() : null
          })
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('focus.save_error'));
      }

      clearDraft();
      setSavedResult(data);
      // Risposta del primo invio persa: l'allenamento c'era già, nessun XP nuovo da festeggiare
      if (data.already_saved) {
        setSnackbar({ open: true, message: t('focus.already_saved'), severity: 'success' });
        return;
      }
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
      if (data.leveled_up) notifyParts.push(t('focus.level_reached', { level: data.new_level }));
      if (data.unlocked_achievements?.length) {
        notifyParts.push(t('focus.achievements', { labels: data.unlocked_achievements.map(a => a.label).join(', ') }));
      }
      if (notifyParts.length) {
        setSnackbar({ open: true, message: notifyParts.join(' · '), severity: 'success' });
      }

    } catch (error) {
      console.error('Errore salvataggio:', error);
      setSnackbar({ open: true, message: error.message || t('focus.save_error'), severity: 'error' });
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
  // PROPS DELLE FASI
  // ================================================
  const quitDialog = {
    quitDialogOpen: confirmQuitDialog,
    onCloseQuitDialog: () => setConfirmQuitDialog(false),
    onConfirmQuit: confirmQuit,
    totalCompletedSets: getTotalCompletedSets(),
  };
  const resumePrompt = {
    draftToResume,
    timeZone: draftTimeZone,
    retroDateInput,
    onRetroDateChange: setRetroDateInput,
    onResume: () => handleResumeDraft(),
    onFinished: handleResumeDraft,
    onDiscard: handleDiscardDraft,
  };
  const selectDay = {
    activePlan,
    selectedDayId,
    selectedDay,
    timerEnabled,
    onDayChange: handleDayChange,
    onStart: handleStartWorkout,
    onBack: () => navigate('/'),
    onGoToPlans: () => navigate('/workouts?tab=plans'),
  };
  const restTimer = {
    timerDuration,
    timerRemaining,
    currentExerciseName: currentExercise?.exercise_name,
    nextSet: currentSlot,
    onSkip: handleSkipTimer,
  };
  const workout = {
    currentExercise,
    currentExerciseIndex,
    totalExercises,
    currentSetIndex,
    totalSlotsForCurrentExercise,
    currentSlot,
    currentExerciseSets,
    canSwap,
    currentSkippedSets,
    lastSession: getLastSession(currentExercise),
    exerciseTransition,
    clockStart,
    // Già finita: la durata è quella del riepilogo e il cronometro non cammina
    finishedClock: retroDate ? getElapsedTime() : null,
    weightInput,
    onWeightChange: setWeightInput,
    repsInput,
    onRepsChange: setRepsInput,
    intensityTechniqueInput,
    onIntensityChange: setIntensityTechniqueInput,
    onConfirmSet: handleConfirmSet,
    onSkipSet: handleSkipSet,
    onSkipWarmup: handleSkipWarmup,
    onSkipExercise: handleSkipExercise,
    canEditSession,
    onOpenPicker: openPicker,
    onQuit: handleQuit,
    ...quitDialog,
    repsConfirmOpen: repsConfirmDialog,
    onCloseRepsConfirm: () => setRepsConfirmDialog(false),
    onConfirmReps: recordSet,
  };
  const summary = {
    activePlan,
    selectedDay,
    completedSets,
    historyIndex,
    shareDate: savedStart ? zoneClock(savedStart, timeZone) : null,
    elapsedSeconds: getElapsedSeconds(),
    elapsedTime: getElapsedTime(),
    workoutNotes,
    onNotesChange: setWorkoutNotes,
    saving,
    savedResult,
    onSave: handleSave,
    onQuit: handleQuit,
    onGoHistory: () => navigate('/workouts?tab=history', { state: { refreshHistory: Date.now() } }),
    onGoHome: () => navigate('/'),
    canEditSession,
    onAddExercise: () => openPicker('add', 'summary'),
    shareStats,
    onOpenShare: setShareStats,
    onCloseShare: () => setShareStats(null),
    ...quitDialog,
  };

  return {
    loading: phase === 'loading' || authLoading,
    phase,
    resumePrompt,
    selectDay,
    restTimer,
    workout,
    summary,
    picker: {
      open: !!picker,
      mode: picker?.mode || 'add',
      currentExercise,
      allowPosition: picker?.from !== 'summary',
      onClose: () => setPicker(null),
      onPick: handlePickExercise,
    },
    premiumDialog: { open: premiumDialog, onClose: () => setPremiumDialog(false) },
    snackbar: { ...snackbar, onClose: () => setSnackbar({ ...snackbar, open: false }) },
  };
}

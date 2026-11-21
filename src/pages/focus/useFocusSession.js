import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isModuleActive } from '../../hooks/useModule';
import { fieldToKg, fieldToKgText, weightToField } from '../../utils/weightUnit';
import { API_BASE_URL } from '../../config';
import { hapticFeedback } from '../../utils/vibration';
import { buildExerciseHistoryIndex, detectPersonalRecords } from '../../utils/workoutMetrics';
import {
  FEATURE_SESSION_EDIT, MAX_WEIGHT, suggestedWeight, slotWeight, totalSlots, setSlot, skipWarmup,
  isValidReps, repsNeedConfirm, plannedSetAt, slotTechnique, isCurrentDraft,
  numberedSets, groupsInExecutionOrder, withWarmupRule, buildSessionEntry, swapExercise, insertExercise,
  newIdempotencyKey, draftIdempotencyKey, editSet, restNextWeight, slotTarget
} from '../../utils/focusSession';
import { celebrate, celebratePR, celebrateStreak, celebrateLevelUp } from '../../utils/celebrate';
import { track } from '../../utils/analytics';
import { currentTimeZone, moveToZoneDay, zoneClock } from '../../utils/workoutTime';
import i18n from '../../i18n';
import { unlockedAchievementsText } from './unlockedAchievementsText';
import { DRAFT_STORAGE_KEY } from '../../utils/focusDraft';
import { isSelectableTechnique } from '../../utils/intensityTechniques';
import { isToolOn } from '../../utils/focusTools';
import { useSaveFocusTool } from '../../hooks/useSaveFocusTool';

// Tecnica con cui parte la serie: quella della scheda, solo se si può ancora scegliere (una tecnica tolta: nessuna)
const startTechnique = (exercise, index) => {
  const technique = slotTechnique(exercise, index);
  return isSelectableTechnique(technique) ? technique : '';
};

// Stato e transizioni di Focus Mode (loading -> select_day o resume_prompt -> workout <-> rest_timer -> summary).
// Restituisce le props di ogni fase, come useFocusSession del mobile.
export default function useFocusSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Giorno proposto dalla Home («Inizia»): dallo stato della navigazione, letto quando arrivano i piani
  const location = useLocation();
  const suggestedDayId = location.state?.suggestedDayId ?? null;
  const suggestedDayRef = useRef(suggestedDayId);
  suggestedDayRef.current = suggestedDayId;
  const { isLoggedIn, loading: authLoading, weightUnit, user } = useAuth();
  // Senza il modulo Livelli i festeggiamenti di streak, livello e traguardi non si mostrano (il server li conta)
  const levelsOn = isModuleActive(user, 'levels');
  // Strumenti della serie: tre valori dell'account, accesi se l'account non dice il contrario
  const restTimerOn = isToolOn(user, 'rest_timer');
  const techniqueOn = isToolOn(user, 'technique');
  const suggestedOn = isToolOn(user, 'suggested_weight');
  const saveFocusTool = useSaveFocusTool();

  // ================================================
  // STATE
  // ================================================
  const [phase, setPhase] = useState('loading'); // loading | select_day | workout | rest_timer | summary | resume_prompt
  const [activePlan, setActivePlan] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  // Indice dello storico per esercizio (ultima sessione + record personali),
  // calcolato dallo storico allenamenti. Usato per il riferimento "Ultima volta"
  // e per il rilevamento dei record (PR) nel riepilogo.
  const [historyIndex, setHistoryIndex] = useState({});

  // Workout state
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState({});
  // Il campo peso è nell'unità dell'utente; i dati (serie, bozza) sempre in kg. weightOrigin = { text, kg } di un campo
  // precompilato (serie precedente): se l'utente non lo tocca si usano i kg originali, non le libbre a schermo.
  const [weightInput, setWeightInput] = useState('');
  const [weightOrigin, setWeightOrigin] = useState(null);
  const [repsInput, setRepsInput] = useState('');
  const [intensityTechniqueInput, setIntensityTechniqueInput] = useState('');
  const [skippedExercises, setSkippedExercises] = useState([]);
  // Serie saltate per voce di sessione: { [ex.id]: [indice serie, ...] }
  const [skippedSets, setSkippedSets] = useState({});
  // Funzioni Plus e Pro abilitate (user/read.php → features): qui solo per mostrare i comandi,
  // il salvataggio lo controlla record_workout.php
  const [features, setFeatures] = useState([]);
  // Picker esercizi: null = chiuso, altrimenti { mode: 'swap' | 'add', from: 'workout' | 'summary' }
  const [picker, setPicker] = useState(null);
  const [lockedDialog, setLockedDialog] = useState(false);

  // Timer state
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const timerRef = useRef(null);
  // Secondi che restavano all'ultimo tocco di ±15 s: li legge lo stato per i lettori di schermo; null se nessun tocco
  const [restNote, setRestNote] = useState(null);

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
        // Segno del formato con le serie pianificate: una bozza senza viene scartata
        plannedSetsFormat: true,
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
  // Con un giorno solo nella scheda, quel giorno è già scelto, a meno che un giorno sia già
  // scelto (bozza ripresa prima che arrivino i piani). Solo setter: stabile.
  const preselectOnlyDay = useCallback((plan) => {
    if (plan?.days?.length !== 1) return;
    setSelectedDayId((current) => current || plan.days[0].id);
    setSelectedDay((current) => current || plan.days[0]);
  }, []);

  // Il giorno proposto dalla Home, se è della scheda attiva, è già scelto (l'utente può cambiarlo, nulla parte da solo);
  // un giorno che non è della scheda si ignora. Solo setter e ref: stabile.
  const preselectSuggestedDay = useCallback((plan) => {
    const suggested = suggestedDayRef.current;
    if (suggested === null) return;
    const day = plan?.days?.find((d) => String(d.id) === String(suggested));
    if (!day) return;
    setSelectedDayId(day.id);
    setSelectedDay(day);
  }, []);

  // useCallback([clearDraft, preselectOnlyDay, preselectSuggestedDay]): non legge stato reattivo (solo localStorage,
  // setter, clearDraft, preselectOnlyDay e preselectSuggestedDay, a loro volta stabili), quindi l'effetto sotto si
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
          if (!isCurrentDraft(parsed)) {
            // Bozza di prima delle serie pianificate: gli esercizi hanno un'altra forma, non si riprende
            clearDraft();
          } else if (parsed.selectedDay && parsed.startTime) {
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
      setFeatures(Array.isArray(userData.features) ? userData.features : []);

      // Trova piano attivo
      if (plansData.records) {
        const active = plansData.records.find(p => p.is_active);
        if (active) {
          setActivePlan(active);
          // Anche con una bozza da riprendere: se l'utente la scarta, prima o dopo l'arrivo dei piani,
          // il giorno unico è già scelto (Riprendi lo sovrascrive)
          preselectOnlyDay(active);
          // Se non c'è bozza, vai alla selezione giorno
          if (!resuming) {
            preselectSuggestedDay(active);
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
  }, [clearDraft, preselectOnlyDay, preselectSuggestedDay]);

  // Il giorno proposto vale una volta: letto (la fase non è più 'loading'), si toglie dallo stato della navigazione, che
  // altrimenti sopravvive a ricarica e tasto indietro e preselezionerebbe un suggerimento vecchio.
  useEffect(() => {
    if (suggestedDayId === null || phase === 'loading') return;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [suggestedDayId, phase, navigate, location.pathname, location.search]);

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

    const day = draftToResume.selectedDay;

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
    setIntensityTechniqueInput(startTechnique(currentEx, draftToResume.currentSetIndex));

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
  const handleDayChange = (dayId) => {
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

  // Riempie il campo peso con un peso in kg (stringa), mostrato nell'unità dell'utente
  const prefillWeight = useCallback((kg) => {
    const text = weightToField(kg, weightUnit);
    setWeightInput(text);
    setWeightOrigin(text === '' ? null : { text, kg });
  }, [weightUnit]);

  // Peso suggerito = top set (peso più alto) delle serie allenanti dell'ultima sessione.
  // Con il peso suggerito spento non c'è niente da suggerire: il campo parte vuoto (0 per il corpo libero).
  const getSuggestedWeight = useCallback((exercise) => (suggestedOn ? suggestedWeight(getLastSession(exercise)) : ''), [getLastSession, suggestedOn]);

  // kg del campo peso (numero, null se non valido) e come stringa per la serie dopo: una volta per render
  const weightKg = fieldToKg(weightInput, weightUnit, MAX_WEIGHT, weightOrigin);
  const weightKgText = fieldToKgText(weightInput, weightUnit, MAX_WEIGHT, weightOrigin);

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
    setIntensityTechniqueInput(startTechnique(firstExercise, 0));
    prefillWeight(slotWeight(firstExercise, 0, { suggested: getSuggestedWeight(firstExercise) }));

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
    setIntensityTechniqueInput(startTechnique(exercise, 0));
    prefillWeight(slotWeight(exercise, 0, { suggested: getSuggestedWeight(exercise) }));
  }, [getSuggestedWeight, prefillWeight]);

  // ================================================
  // CONFERMA SERIE
  // ================================================
  // Porta la sessione alla posizione `index` dell'esercizio corrente: peso dato, ripetizioni vuote, tecnica della serie
  const goToSlot = (index, weight) => {
    setCurrentSetIndex(index);
    prefillWeight(weight);
    setRepsInput('');
    setIntensityTechniqueInput(startTechnique(currentExercise, index));
  };

  const handleConfirmSet = () => {
    if (weightKg === null || !isValidReps(repsInput)) return;
    if (repsNeedConfirm(repsInput, plannedSetAt(currentExercise, currentSetIndex))) {
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
    const newSet = withWarmupRule({
      setNumber: currentSetIndex + 1,
      weight: weightKg,
      reps: String(parseInt(repsInput, 10)),
      // Con la tecnica spenta la serie si salva senza, anche se la scheda ne prevedeva una
      intensity_technique: techniqueOn ? intensityTechniqueInput : '',
      is_warmup: isWarmup,
      // Secondi netti dall'inizio (stesso orologio della durata); in modalità "già finito" l'orario non è reale.
      // Non passa da getElapsedSeconds()/netEnd: preferiscono endTime, congelato nel riepilogo e in retro, mentre qui serve "adesso"
      seconds_from_start: retroDate || !startTime ? null : Math.max(0, Math.floor((Date.now() - startTime.getTime() - pausedMs) / 1000))
    });

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
      goToSlot(nextSetIndex, slotWeight(currentExercise, nextSetIndex, { suggested: getSuggestedWeight(currentExercise), current: weightKgText }));

      // Avvia timer di recupero se abilitato
      if (restTimerOn && currentExercise.rest > 0) {
        startRestTimer(currentExercise.rest);
      }
    }
  };

  // Corregge una serie già fatta (peso, ripetizioni, tecnica): la bozza si riscrive da sola come per ogni cambio
  const handleEditSet = (rowId, setNumber, changes) => {
    setCompletedSets(prev => ({ ...prev, [rowId]: editSet(prev[rowId] || [], setNumber, changes) }));
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

  // Aggiunge posizioni alle serie saltate dell'esercizio corrente
  const addSkippedSets = (indexes) => {
    const exerciseId = currentExercise.id;
    setSkippedSets(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), ...indexes] }));
  };

  // Salta solo la serie corrente: non viene registrata e non parte il recupero.
  // Il peso già scritto resta, servirà per la serie dopo.
  const handleSkipSet = () => {
    // workingIndex è -1 in riscaldamento e 0 alla prima serie allenante (= salta esercizio)
    if (currentSlot.workingIndex < 1) return;
    hapticFeedback.light();
    addSkippedSets([currentSetIndex]);
    const nextSetIndex = currentSetIndex + 1;
    if (nextSetIndex >= totalSlotsForCurrentExercise) {
      goToNextExercise();
    } else {
      goToSlot(nextSetIndex, weightKgText);
    }
  };

  // Salta le serie di riscaldamento rimaste: niente recupero, si riparte dalla prima serie allenante
  const handleSkipWarmup = () => {
    if (!currentSlot.isWarmup) return;
    hapticFeedback.light();
    const { skipped, nextIndex } = skipWarmup(currentExercise, currentSetIndex);
    addSkippedSets(skipped);
    goToSlot(nextIndex, slotWeight(currentExercise, nextIndex, { suggested: getSuggestedWeight(currentExercise) }));
  };

  // ================================================
  // CAMBIO / AGGIUNTA ESERCIZIO (Plus e Pro, solo per questa sessione)
  // ================================================
  // Le modifiche vanno in selectedDay.exercises: bozza, salvataggio, riepilogo e
  // barra di avanzamento le vedono senza altro codice.
  const openPicker = (pickerMode, from = 'workout') => {
    if (!canEditSession) {
      setLockedDialog(true);
      return;
    }
    if (pickerMode === 'swap' && !canSwap) {
      setSnackbar({ open: true, message: t('focus.swap_only_before_sets'), severity: 'info' });
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
  const runCountdown = () => {
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

  const startRestTimer = (durationSeconds) => {
    setTimerDuration(durationSeconds);
    setTimerRemaining(durationSeconds);
    setRestNote(null);
    setPhase('rest_timer');
    runCountdown();
  };

  // ±15 s: cambiano solo il recupero in corso. Il tempo già passato resta, quindi la durata segue i secondi rimasti.
  // A zero il conto si ferma (senza vibrazione, che è solo dello scadere naturale) e la schermata resta; da zero +15 lo fa ripartire.
  const handleAdjustTimer = (delta) => {
    const next = Math.max(0, timerRemaining + delta);
    if (next === timerRemaining) return;
    setTimerDuration(timerDuration + next - timerRemaining);
    setTimerRemaining(next);
    setRestNote(next > 0 ? next : null);
    if (next === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    } else {
      runCountdown();
    }
  };

  const handleSkipTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRemaining(0);
    setRestNote(null);
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

      groupsInExecutionOrder(completedSets).forEach(([exerciseId, sets]) => {
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
            set_number: set.set_number,
            seconds_from_start: set.seconds_from_start ?? null
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

      if (!levelsOn) return;

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
        notifyParts.push(t('focus.achievements', { labels: unlockedAchievementsText(data.unlocked_achievements, weightUnit) }));
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
    onDayChange: handleDayChange,
    onStart: handleStartWorkout,
    onBack: () => navigate('/'),
    onGoToPlans: () => navigate('/schede'),
  };
  const restTimer = {
    timerDuration,
    timerRemaining,
    currentExerciseName: currentExercise?.exercise_name,
    nextSet: currentSlot,
    // Serie successiva: la posizione corrente è già quella dopo (goToSlot) e il campo peso è già pronto
    nextWeightKg: phase === 'rest_timer' && currentExercise && currentSetIndex > 0 ? restNextWeight({
      field: weightKgText,
      previous: (completedSets[currentExercise.id] || []).at(-1)?.weight,
      previousIsWarmup: setSlot(currentExercise, currentSetIndex - 1).isWarmup,
      nextIsWarmup: currentSlot?.isWarmup,
    }) : null,
    nextTarget: phase === 'rest_timer' && currentExercise ? slotTarget(currentExercise, currentSetIndex) : '',
    weightUnit,
    restNote,
    onAdjust: handleAdjustTimer,
    onSkip: handleSkipTimer,
  };
  // «Non suggerire più»: spegne lo strumento per l'account e dice se è riuscito; se non riesce resta acceso (l'errore lo mostra
  // la spiegazione). L'avviso di dove si riaccende lo manda la spiegazione a finestra uscita (`onSuggestedOff`).
  const disableSuggested = async () => (await saveFocusTool('suggested_weight', false)).ok;
  const workout = {
    currentExercise,
    techniqueOn,
    // Nelle serie allenanti, il peso (kg, come stringa) da suggerire: vuoto se spento o senza storico
    suggestedKg: currentExercise && currentSlot && !currentSlot.isWarmup ? getSuggestedWeight(currentExercise) : '',
    onDisableSuggested: disableSuggested,
    onSuggestedOff: () => setSnackbar({ open: true, message: t('focus.suggested.disabled', { tools: t('focus.tools.title') }), severity: 'success' }),
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
    weightUnit,
    weightValid: weightKg !== null,
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
    onEditSet: handleEditSet,
  };
  const summary = {
    weightUnit,
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
    onGoHistory: () => navigate('/storico', { state: { refreshHistory: Date.now() } }),
    onGoHome: () => navigate('/'),
    canEditSession,
    techniqueOn,
    onEditSet: handleEditSet,
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
    lockedDialog: { open: lockedDialog, onClose: () => setLockedDialog(false) },
    snackbar: { ...snackbar, onClose: () => setSnackbar({ ...snackbar, open: false }) },
  };
}

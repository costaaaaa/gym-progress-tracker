import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Card,
  CardContent,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Button,
  TextField,
  IconButton
} from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { API_BASE_URL } from '../config';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'; // Gambe
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'; // Corpo intero
import FlexibleIcon from '@mui/icons-material/AirlineSeatReclineNormal'; // Flessibilità
import SportsMartialArtsIcon from '@mui/icons-material/SportsMartialArts'; // Braccia
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement'; // Addominali
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import itLocale from 'date-fns/locale/it';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DateRangeIcon from '@mui/icons-material/DateRange';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import TuneIcon from '@mui/icons-material/Tune';

const Progress = () => {
  // Configurazione dei gruppi muscolari
  const muscleGroups = ['Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Polpacci', 'Addominali'];
  
  // Stati per gli esercizi caricati dal database
  const [exercisesByMuscleGroup, setExercisesByMuscleGroup] = useState({});
  const [loadingExercises, setLoadingExercises] = useState(true);

  // Stati per gestione selezioni e dati
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');
  const [selectedExercise, setSelectedExercise] = useState({ id: '', name: '' });
  const [progressData, setProgressData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Stati per filtri temporali
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [filteredChartData, setFilteredChartData] = useState([]);
  
  // Stato per la visualizzazione compatta degli allenamenti
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [visibleWorkouts, setVisibleWorkouts] = useState([]);
  
  // Statistiche di progresso
  const [startWeight, setStartWeight] = useState(0);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [weightIncrease, setWeightIncrease] = useState(0);
  const [percentageIncrease, setPercentageIncrease] = useState(0);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [exerciseStats, setExerciseStats] = useState([]);

  // Debug: visualizza un messaggio di stato sul grafico
  const [debugMessage, setDebugMessage] = useState('');

  // Nel componente Progress aggiungo nuovi stati di debug
  const [dataFormat, setDataFormat] = useState({ valid: false, message: '' });
  const [apiResponseData, setApiResponseData] = useState(null);

  // Stati per le nuove statistiche globali
  const [frequencyData, setFrequencyData] = useState([]);
  const [totalVolumeData, setTotalVolumeData] = useState([]);

  // Stato per tracciare le metriche visibili nel grafico
  const [visibleMetrics, setVisibleMetrics] = useState({
    volume: true,
    volumePerSet: true,
    avgWeight: true,
    compositeIndex: true,
    trendLines: true
  });

  const fetchGlobalStats = async () => {
    try {
      const [freqRes, volRes] = await Promise.all([
        fetch(`${API_BASE_URL}api/workout_stats/frequency.php`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}api/workout_stats/volume.php`, { credentials: 'include' })
      ]);
      const freqData = await freqRes.json();
      const volData = await volRes.json();
      
      if (freqData.records) {
        setFrequencyData(freqData.records.map(r => ({
          ...r,
          label: `Settimana ${r.year_week.toString().slice(-2)}`
        })));
      }
      if (volData.records) {
        setTotalVolumeData(volData.records.map(r => ({
          ...r,
          dateFormatted: new Date(r.workout_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
        })));
      }
    } catch (error) {
      console.error('Error fetching global stats:', error);
    }
  };

  // Carica gli esercizi dal database all'avvio del componente
  useEffect(() => {
    fetchExercises();
    fetchGlobalStats();
  }, []);

  // Imposta il gruppo muscolare predefinito dopo che gli esercizi sono stati caricati
  useEffect(() => {
    if (!loadingExercises && Object.keys(exercisesByMuscleGroup).length > 0) {
      setSelectedMuscleGroup(muscleGroups[0]);
    }
  }, [loadingExercises, exercisesByMuscleGroup]);

  // Imposta l'esercizio predefinito quando cambia il gruppo muscolare
  useEffect(() => {
    if (selectedMuscleGroup && exercisesByMuscleGroup[selectedMuscleGroup] && 
        exercisesByMuscleGroup[selectedMuscleGroup].length > 0) {
      const firstExercise = exercisesByMuscleGroup[selectedMuscleGroup][0];
      // Aggiornato per memorizzare sia id che nome
      setSelectedExercise({
        id: firstExercise.id,
        name: firstExercise.name
      });
    }
  }, [selectedMuscleGroup, exercisesByMuscleGroup]);

  // Carica i dati quando cambia l'esercizio selezionato
  useEffect(() => {
    if (selectedExercise.id && selectedExercise.name) {
      setDebugMessage('');  // Reset del messaggio di debug
      // Mostra dati di debug sulla console
      console.log(`Fetching data for exercise: ${JSON.stringify(selectedExercise)}`);
      fetchWorkoutHistory();
    }
  }, [selectedExercise]);

  // Applica filtri temporali quando cambiano i dati o i filtri
  useEffect(() => {
    if (chartData.length === 0) {
      setFilteredChartData([]);
      return;
    }
    
    const filteredData = applyDateFilter(chartData);
    
    // Ricalcola l'indice composito basato sui dati filtrati
    if (filteredData.length >= 2) {
      const recalculatedData = recalculateCompositeIndex(filteredData);
      // Ricalcola anche la linea di tendenza con i dati aggiornati
      const trendLineData = calculateTrendLine(recalculatedData);
      setFilteredChartData(trendLineData);
    } else {
      setFilteredChartData(filteredData);
    }
    
    // Calcola nuovamente le statistiche basate sui dati filtrati
    if (filteredData.length > 0) {
      updateStatisticsBasedOnMetric(filteredData);
    } else {
      // Reset delle statistiche se non ci sono dati filtrati
      setStartWeight(0);
      setCurrentWeight(0);
      setWeightIncrease(0);
      setPercentageIncrease(0);
    }
    
    // Aggiorna la lista degli allenamenti visibili
    updateVisibleWorkouts(exerciseStats);
    
  }, [chartData, dateRange, customStartDate, customEndDate]);
  
  // Aggiorna i workout visibili quando cambia lo stato di visualizzazione
  useEffect(() => {
    updateVisibleWorkouts(exerciseStats);
  }, [exerciseStats, showAllWorkouts]);

  // Funzione per caricare gli esercizi dal database
  const fetchExercises = async () => {
    setLoadingExercises(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/exercise/read_all.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.records && Array.isArray(data.records)) {
        // Organizziamo gli esercizi per gruppo muscolare
        const exercisesByGroup = {};
        
        // Inizializziamo i gruppi muscolari
        muscleGroups.forEach(group => {
          exercisesByGroup[group] = [];
        });
        
        // Aggiungiamo gli esercizi ai rispettivi gruppi
        data.records.forEach(exercise => {
          const muscleGroup = exercise.muscle_group;
          
          // Mappiamo i gruppi muscolari dal database ai gruppi dell'UI
          let groupToUse = null;
          
          if (muscleGroup === 'petto') groupToUse = 'Petto';
          else if (muscleGroup === 'schiena') groupToUse = 'Schiena';
          else if (muscleGroup === 'spalle') groupToUse = 'Spalle';
          else if (muscleGroup === 'bicipiti') groupToUse = 'Bicipiti';
          else if (muscleGroup === 'tricipiti') groupToUse = 'Tricipiti';
          else if (muscleGroup === 'gambe') groupToUse = 'Gambe';
          else if (muscleGroup === 'polpacci') groupToUse = 'Polpacci';
          else if (muscleGroup === 'addominali') groupToUse = 'Addominali';
          
          // Se il gruppo è mappato, aggiungiamo l'esercizio
          if (groupToUse && muscleGroups.includes(groupToUse)) {
            exercisesByGroup[groupToUse].push({
              id: exercise.id,
              name: exercise.name,
              originalGroup: muscleGroup // Conserviamo il gruppo originale per debugging
            });
          }
        });
        
        // Log dei gruppi e numero di esercizi per gruppo
        Object.keys(exercisesByGroup).forEach(group => {
          console.log(`Gruppo ${group}: ${exercisesByGroup[group].length} esercizi`);
        });
        
        setExercisesByMuscleGroup(exercisesByGroup);
      } else {
        // Se non ci sono dati, utilizziamo una struttura vuota
        const emptyExercises = {};
        muscleGroups.forEach(group => {
          emptyExercises[group] = [];
        });
        setExercisesByMuscleGroup(emptyExercises);
        
        setSnackbar({
          open: true,
          message: 'Non sono stati trovati esercizi nel database',
          severity: 'warning'
        });
      }
    } catch (error) {
      console.error('Errore nel caricamento degli esercizi:', error);
      setSnackbar({
        open: true,
        message: 'Errore nel caricamento degli esercizi: ' + (error.message || 'Errore sconosciuto'),
        severity: 'error'
      });
      
      // In caso di errore, inizializziamo comunque la struttura
      const emptyExercises = {};
      muscleGroups.forEach(group => {
        emptyExercises[group] = [];
      });
      setExercisesByMuscleGroup(emptyExercises);
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleMuscleGroupChange = (event) => {
    setSelectedMuscleGroup(event.target.value);
  };

  // Modifico la funzione per gestire sia ID che nome dell'esercizio
  const handleExerciseChange = (event) => {
    const exerciseId = event.target.value;
    const selectedExerciseObj = exercisesByMuscleGroup[selectedMuscleGroup].find(ex => ex.id === exerciseId);
    
    if (selectedExerciseObj) {
      console.log(`✅ Esercizio selezionato: ID=${selectedExerciseObj.id}, Nome="${selectedExerciseObj.name}"`);
      
      // Debug: stampa tutti i possibili nomi alternativi che potremmo cercare
      const nameLowerCase = selectedExerciseObj.name.toLowerCase();
      const nameWithoutSpaces = nameLowerCase.replace(/\s+/g, '');
      const nameSimplified = nameLowerCase.replace(/[^a-z]/g, '');
      
      console.log(`🔤 Possibili varianti del nome da cercare:`);
      console.log(`  - Originale: "${selectedExerciseObj.name}"`);
      console.log(`  - Minuscolo: "${nameLowerCase}"`);
      console.log(`  - Senza spazi: "${nameWithoutSpaces}"`);
      console.log(`  - Semplificato: "${nameSimplified}"`);
      
      setSelectedExercise({
        id: selectedExerciseObj.id,
        name: selectedExerciseObj.name
      });
      
      // Reset del grafico per evitare confusione
      setChartData([]);
      setExerciseStats([]);
      setDebugMessage('');
    }
  };

  // Modifica la funzione fetchWorkoutHistory per migliorare l'analisi dei dati che arrivano dal backend con la nuova struttura della tabella workout_sets. Dobbiamo aggiungere un controllo più chiaro sulla struttura dei dati restituiti.
  const fetchWorkoutHistory = async () => {
    setIsLoading(true);
    setApiResponseData(null); // Reset dei dati di debug della risposta
    setDataFormat({ valid: false, message: '' }); // Reset dello stato del formato dati
    
    console.log(`🔍 Richiesta cronologia allenamenti per esercizio: "${selectedExercise.name}" (ID: ${selectedExercise.id})`);
    
    try {
      const response = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include'
      });
      
      // Controlla lo stato della risposta
      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status} ${response.statusText}`);
      }
      
      // Estrai i dati in formato JSON
      const data = await response.json();
      
      // Salva i dati grezzi della risposta per debug
      setApiResponseData(data);
      
      // Log dettagliato del formato della risposta
      console.log('📥 Risposta ricevuta dal server:');
      console.log('  - Tipo di risposta:', typeof data);
      
      if (typeof data !== 'object') {
        setDataFormat({ valid: false, message: 'Formato risposta non valido: non è un oggetto' });
        throw new Error('Formato risposta non valido: non è un oggetto');
      }
      
      if (!data.records) {
        setDataFormat({ valid: false, message: 'Formato risposta non valido: records non trovato' });
        throw new Error('Formato risposta non valido: records non trovato');
      }
      
      console.log(`  - Tipo di data.records:`, typeof data.records);
      console.log(`  - È un array:`, Array.isArray(data.records));
      
      if (data.records && Array.isArray(data.records)) {
        // Debug: numero totale di record ricevuti
        console.log(`📊 Ricevuti ${data.records.length} allenamenti dal server`);
        setDataFormat({ valid: true, message: `${data.records.length} allenamenti trovati` });
        
        // Ordina per data
        const sortedWorkouts = data.records.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Debug dettagliato per ogni allenamento
        sortedWorkouts.forEach((workout, index) => {
          console.log(`🏋️ Allenamento ${index+1}/${sortedWorkouts.length} (${workout.date}):`);
          if (!workout.exercises) {
            console.warn(`  ⚠️ Nessun esercizio definito in questo allenamento`);
          } else if (!Array.isArray(workout.exercises)) {
            console.warn(`  ⚠️ workout.exercises non è un array: ${typeof workout.exercises}`);
          } else {
            console.log(`  📋 Contiene ${workout.exercises.length} esercizi:`);
            workout.exercises.forEach((ex, i) => {
              // Controlla se utilizza la nuova struttura (esercizi raggruppati con array di set)
              const usesNewStructure = ex.sets && Array.isArray(ex.sets) && ex.sets.length > 0;
              console.log(`    ${i+1}. ${ex.name || 'Nome non definito'} (ID: ${ex.exercise_id || 'N/A'}) (${ex.sets?.length || 0} set) [${usesNewStructure ? 'Nuova struttura' : 'Vecchia struttura'}]`);
              
              // Debug dettagliato dei set se presente la nuova struttura
              if (usesNewStructure) {
                ex.sets.forEach((set, setIndex) => {
                  console.log(`      - Set ${setIndex+1}: ${set.reps || 0} reps x ${set.weight || 0} kg`);
                });
              }
            });
          }
        });
        
        setWorkoutHistory(sortedWorkouts);
        
        // Analizziamo i dati e costruiamo le statistiche
        calculateExerciseStats(sortedWorkouts);
      } else {
        console.warn("❌ Dati non validi: records non trovato o non è un array", data);
        setDataFormat({ valid: false, message: 'Formato dati non valido dal server' });
        setDebugMessage('Formato dati non valido dal server');
        setWorkoutHistory([]);
        setExerciseStats([]);
        setChartData([]);
      }
    } catch (error) {
      console.error('❌ Errore completo:', error);
      
      // Messaggio più amichevole per l'errore 404
      let errorMessage = 'Errore nel caricamento della cronologia';
      
      if (error.message.includes('404')) {
        errorMessage = 'Nessun dato di allenamento disponibile. Registra il tuo primo allenamento!';
        setDebugMessage('Nessun dato di allenamento disponibile');
      } else {
        // Mantieni l'errore tecnico nei log ma mostra un messaggio più amichevole
        errorMessage += ': si è verificato un problema di connessione';
        setDebugMessage(`Si è verificato un problema di connessione`);
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'info' // Cambiato da 'error' a 'info' per il 404 che è un caso normale per un nuovo utente
      });
      
      setWorkoutHistory([]);
      setExerciseStats([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione corretta per trovare esercizi negli allenamenti senza mescolare esercizi simili
  const findExerciseInWorkout = (workout, selectedExerciseId, selectedExerciseName) => {
    if (!workout?.exercises || !Array.isArray(workout.exercises)) {
      console.warn(`  ⚠️ Allenamento del ${workout.date}: esercizi non presenti o non validi`);
      return null;
    }
    
    console.log(`  📋 Cerco esercizio ID:${selectedExerciseId} Nome:"${selectedExerciseName}" in ${workout.exercises.length} esercizi`);
    
    // Log versione ridotta degli esercizi disponibili
    workout.exercises.forEach((ex, i) => {
      console.log(`    - Esercizio ${i+1}: ID=${ex.exercise_id || 'N/A'}, Nome="${ex.name || 'N/A'}", Set=${ex.sets?.length || 0}`);
    });
    
    // Metodo 1: Ricerca diretta per ID (metodo principale e più affidabile)
    if (selectedExerciseId) {
      console.log(`  🔎 Metodo 1: Ricerca per ID esatto "${selectedExerciseId}"`);
      
      const exerciseWithExactId = workout.exercises.find(ex => 
        ex.exercise_id && String(ex.exercise_id).trim() === String(selectedExerciseId).trim()
      );
      
      if (exerciseWithExactId) {
        console.log(`    ✅ MATCH trovato per ID esatto "${selectedExerciseId}" (nome: "${exerciseWithExactId.name}")`);
        return exerciseWithExactId;
      }
      
      console.log(`    ❌ Nessun match trovato per ID esatto`);
    }
    
    // Metodo 2: Ricerca per nome esatto (come fallback, solo se non si è trovato per ID)
    if (selectedExerciseName) {
      console.log(`  🔎 Metodo 2: Ricerca per nome esatto "${selectedExerciseName}"`);
      
      const normalizedName = selectedExerciseName.trim().toLowerCase();
      const exerciseWithExactName = workout.exercises.find(ex => 
        ex.name && ex.name.trim().toLowerCase() === normalizedName
      );
      
      if (exerciseWithExactName) {
        console.log(`    ✅ MATCH trovato per nome esatto "${exerciseWithExactName.name}"`);
        return exerciseWithExactName;
      }
      
      console.log(`    ❌ Nessun match trovato per nome esatto`);
    }
    
    // Se non viene trovato né per ID né per nome esatto, non ritorniamo nulla
    // Rimuoviamo tutti i metodi di ricerca flessibile per evitare falsi positivi
    
    console.log(`  ❌ NESSUN ESERCIZIO TROVATO nell'allenamento del ${workout.date}`);
    return null;
  };

  // Nuova funzione di debug per trovare incongruenze
  const findExercisesMismatch = (workouts, selectedExercise) => {
    if (!workouts || workouts.length === 0 || !selectedExercise.name) {
      return;
    }
    
    console.log(`🔍 ANALISI APPROFONDITA per l'esercizio "${selectedExercise.name}" (ID: ${selectedExercise.id})`);
    
    // Lista per memorizzare tutti gli esercizi nei workout con nomi simili
    const similarExercises = [];
    
    // Cerca esercizi con nomi simili o ID corrispondenti
    workouts.forEach(workout => {
      if (!workout.exercises || !Array.isArray(workout.exercises)) return;
      
      workout.exercises.forEach(ex => {
        if (!ex.name) return;
        
        const nameSimilarity = checkNameSimilarity(selectedExercise.name, ex.name);
        const idMatch = ex.exercise_id && String(ex.exercise_id).trim() === String(selectedExercise.id).trim();
        
        if (nameSimilarity > 0.3 || idMatch) {
          similarExercises.push({
            workoutDate: workout.date,
            exerciseName: ex.name,
            exerciseId: ex.exercise_id || 'N/A',
            similarity: nameSimilarity,
            idMatches: idMatch,
            setsCount: ex.sets?.length || 0
          });
        }
      });
    });
    
    // Se troviamo esercizi simili, mostriamo un report
    if (similarExercises.length > 0) {
      console.log(`🔎 Trovati ${similarExercises.length} esercizi potenzialmente corrispondenti:`);
      
      // Identifica possibili incongruenze
      const differentIds = new Set();
      const differentNames = new Set();
      
      similarExercises.forEach(item => {
        console.log(`  📅 ${item.workoutDate}: "${item.exerciseName}" (ID: ${item.exerciseId}) - ${item.setsCount} set`);
        console.log(`     Somiglianza nome: ${(item.similarity * 100).toFixed(0)}%, Corrispondenza ID: ${item.idMatches ? 'SÌ' : 'NO'}`);
        
        if (!item.idMatches && item.similarity > 0.7) {
          differentIds.add(item.exerciseId);
          console.log(`     ⚠️ POSSIBILE INCONGRUENZA ID: esercizio molto simile ma ID diverso!`);
        }
        
        if (item.idMatches && item.similarity < 0.7) {
          differentNames.add(item.exerciseName);
          console.log(`     ⚠️ POSSIBILE INCONGRUENZA NOME: stesso ID ma nome diverso!`);
        }
      });
      
      // Report riassuntivo delle incongruenze
      if (differentIds.size > 0 || differentNames.size > 0) {
        console.log(`⚠️ ATTENZIONE: Trovate possibili incongruenze tra database ed esercizi negli allenamenti:`);
        
        if (differentIds.size > 0) {
          console.log(`  ❌ ID DIVERSI trovati per esercizi con nomi simili: ${Array.from(differentIds).join(', ')}`);
          console.log(`     L'ID corretto dovrebbe essere: ${selectedExercise.id}`);
        }
        
        if (differentNames.size > 0) {
          console.log(`  ❌ NOMI DIVERSI trovati per esercizi con stesso ID: ${Array.from(differentNames).join(', ')}`);
          console.log(`     Il nome corretto dovrebbe essere: ${selectedExercise.name}`);
        }
      }
    } else {
      console.log(`❌ Nessun esercizio simile trovato nei workout`);
    }
  };

  // Funzione helper per calcolare la somiglianza tra due nomi
  const checkNameSimilarity = (name1, name2) => {
    if (!name1 || !name2) return 0;
    
    // Normalizza e semplifica i nomi
    const simplifyName = (name) => name
      .toLowerCase()
      .replace(/[0-9.,\-_()]/g, '')  // rimuove numeri e caratteri speciali
      .replace(/\s+/g, ' ')          // normalizza spazi
      .trim();
      
    const simplified1 = simplifyName(name1);
    const simplified2 = simplifyName(name2);
    
    // Se uno contiene l'altro, alta somiglianza
    if (simplified1.includes(simplified2) || simplified2.includes(simplified1)) {
      return 0.8;
    }
    
    // Verifica parole in comune
    const words1 = simplified1.split(' ');
    const words2 = simplified2.split(' ');
    
    const commonWords = words1.filter(word => 
      word.length > 2 && words2.some(word2 => word2.includes(word) || word.includes(word2))
    );
    
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  // Funzione per costruire una mappa di ID inconsistenti
  const buildInconsistentIdsMap = (workouts) => {
    // Mappa per tenere traccia delle corrispondenze tra nomi e ID
    const nameToIds = new Map();
    const idMappings = new Map();
    const inconsistencies = [];
    
    // Prima passata: raccogliamo tutti i nomi e gli ID associati
    workouts.forEach(workout => {
      if (!workout.exercises || !Array.isArray(workout.exercises)) return;
      
      workout.exercises.forEach(ex => {
        if (!ex.name || !ex.exercise_id) return;
        
        const normalizedName = ex.name.trim().toLowerCase();
        
        if (!nameToIds.has(normalizedName)) {
          nameToIds.set(normalizedName, new Set());
        }
        
        nameToIds.get(normalizedName).add(ex.exercise_id);
      });
    });
    
    // Seconda passata: identifichiamo nomi con ID multipli
    for (const [name, ids] of nameToIds.entries()) {
      if (ids.size > 1) {
        inconsistencies.push({
          name,
          ids: Array.from(ids),
          workoutDates: []
        });
        
        // Aggiungiamo le date degli allenamenti per ciascun ID
        inconsistencies[inconsistencies.length - 1].workoutDates = workouts
          .filter(w => w.exercises && Array.isArray(w.exercises))
          .filter(w => w.exercises.some(ex => 
            ex.name && ex.name.trim().toLowerCase() === name && ex.exercise_id
          ))
          .map(w => ({
            date: w.date,
            id: w.exercises.find(ex => ex.name.trim().toLowerCase() === name).exercise_id
          }));
      }
    }
    
    // Log delle inconsistenze trovate
    if (inconsistencies.length > 0) {
      console.log(`⚠️ Trovate ${inconsistencies.length} inconsistenze negli ID degli esercizi:`);
      
      inconsistencies.forEach(item => {
        console.log(`  📊 Esercizio "${item.name}" ha ${item.ids.length} ID diversi: ${item.ids.join(', ')}`);
        console.log(`     Trovato in ${item.workoutDates.length} allenamenti:`);
        
        item.workoutDates.forEach(dateInfo => {
          console.log(`     - ${dateInfo.date}: ID="${dateInfo.id}"`);
        });
      });
      
      console.log(`⚠️ Dovresti correggere queste inconsistenze nel database per risultati migliori.`);
    } else {
      console.log(`✅ Non sono state trovate inconsistenze negli ID degli esercizi.`);
    }
    
    return {
      inconsistencies,
      nameToIds
    };
  };

  // Funzione per estrarre il numero di ripetizioni da una stringa
  const extractRepsFromString = (repsString) => {
    if (!repsString) return 0;
    
    // Se è già un numero, lo ritorniamo
    if (!isNaN(repsString)) {
      return parseInt(repsString) || 0;
    }
    
    // Casi comuni: "8-10" prende il valore massimo (10)
    if (repsString.includes('-')) {
      const parts = repsString.split('-');
      if (parts.length === 2) {
        const max = parseInt(parts[1].trim());
        if (!isNaN(max)) return max;
      }
    }
    
    // Estrai il primo numero che compare nella stringa
    // Questo gestisce casi come "1 rest pause a 20" prendendo il 20 come numero di ripetizioni
    const matches = repsString.match(/\d+/g);
    if (matches && matches.length > 0) {
      // Se ci sono più numeri, prendiamo il più grande come stima migliore
      return Math.max(...matches.map(m => parseInt(m)));
    }
    
    // Se non troviamo numeri, ritorniamo 0
    return 0;
  };
  
  // Calcola la linea di tendenza (regressione lineare)
  const calculateTrendLine = (data) => {
    if (data.length < 2) return data.map(point => ({ 
      ...point, 
      trendVolume: point.volume,
      trendAvgWeight: point.avgWeight,
      trendVolumePerSet: point.volumePerSet,
      compositeIndex: 100
    }));
    
    // Valori iniziali per normalizzazione
    const initialVolume = data[0].volume;
    const initialAvgWeight = data[0].avgWeight;
    const initialVolumePerSet = data[0].volumePerSet;
    
    // Calcola l'indice composito normalizzato per ogni punto
    const dataWithComposite = data.map(point => {
      // Normalizza le metriche in percentuale rispetto al valore iniziale
      const volumeNormalized = (point.volume / initialVolume) * 100;
      const avgWeightNormalized = (point.avgWeight / initialAvgWeight) * 100;
      const volumePerSetNormalized = (point.volumePerSet / initialVolumePerSet) * 100;
      
      // Media ponderata delle tre metriche con i pesi specificati:
      // - 50% peso medio per ripetizione
      // - 25% volume totale
      // - 25% volume per serie
      const compositeIndex = 
        (avgWeightNormalized * 0.5) + 
        (volumeNormalized * 0.25) + 
        (volumePerSetNormalized * 0.25);
      
      return {
        ...point,
        compositeIndex: parseFloat(compositeIndex.toFixed(1))
      };
    });
    
    // Funzione helper per calcolare la regressione lineare
    const calculateRegression = (data, valueKey) => {
      const n = data.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      
      // Usa gli indici come valori x e la metrica specificata come valori y
      data.forEach((point, index) => {
        sumX += index;
        sumY += point[valueKey];
        sumXY += index * point[valueKey];
        sumXX += index * index;
      });
      
      // Calcola pendenza (m) e intercetta (b) per y = mx + b
      const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const b = (sumY - m * sumX) / n;
      
      return { m, b };
    };
    
    // Calcola le regressioni per volume, avgWeight, volumePerSet e l'indice composito
    const volumeRegression = calculateRegression(dataWithComposite, 'volume');
    const avgWeightRegression = calculateRegression(dataWithComposite, 'avgWeight');
    const volumePerSetRegression = calculateRegression(dataWithComposite, 'volumePerSet');
    const compositeRegression = calculateRegression(dataWithComposite, 'compositeIndex');
    
    console.log(`📈 Linea di tendenza volume: y = ${volumeRegression.m.toFixed(2)}x + ${volumeRegression.b.toFixed(2)}`);
    console.log(`📈 Linea di tendenza peso medio: y = ${avgWeightRegression.m.toFixed(2)}x + ${avgWeightRegression.b.toFixed(2)}`);
    console.log(`📈 Linea di tendenza volume per serie: y = ${volumePerSetRegression.m.toFixed(2)}x + ${volumePerSetRegression.b.toFixed(2)}`);
    console.log(`📈 Linea di tendenza indice composito: y = ${compositeRegression.m.toFixed(2)}x + ${compositeRegression.b.toFixed(2)}`);
    
    // Crea punti per le linee di tendenza, includendo l'indice composito
    return dataWithComposite.map((point, index) => ({
      ...point,
      trendVolume: parseFloat((volumeRegression.m * index + volumeRegression.b).toFixed(2)),
      trendAvgWeight: parseFloat((avgWeightRegression.m * index + avgWeightRegression.b).toFixed(2)),
      trendVolumePerSet: parseFloat((volumePerSetRegression.m * index + volumePerSetRegression.b).toFixed(2)),
      trendComposite: parseFloat((compositeRegression.m * index + compositeRegression.b).toFixed(1))
    }));
  };
  
  // Modifica la funzione calculateExerciseStats per utilizzare la versione semplificata
  const calculateExerciseStats = (workouts) => {
    console.log("🔍 Inizio calcolo statistiche per:", selectedExercise);
    
    // Resetta i messaggi di debug e inizializza variabili
    setDebugMessage('');
    
    // Visualizza messaggio di debug e non elabora dati se mancano gli input necessari
    if (!workouts || workouts.length === 0) {
      console.warn("⚠️ Nessun allenamento disponibile");
      setDebugMessage('Nessun allenamento disponibile');
      setExerciseStats([]);
      setChartData([]);
      return;
    }
    
    if (!selectedExercise.id || !selectedExercise.name) {
      console.warn("⚠️ Esercizio selezionato non valido:", selectedExercise);
      setDebugMessage('Esercizio selezionato non valido');
      setExerciseStats([]);
      setChartData([]);
      return;
    }
    
    // Log dettagliato per debug
    console.log(`🔍 Cerco l'esercizio "${selectedExercise.name}" (ID: ${selectedExercise.id}) in ${workouts.length} allenamenti`);
    
    // Cerca l'esercizio selezionato in tutti gli allenamenti
    const relevantWorkoutsData = [];
    
    for (const workout of workouts) {
      console.log(`🔎 Analisi allenamento del ${workout.date}...`);
      
      // Usa la funzione helper per trovare l'esercizio
      const exerciseData = findExerciseInWorkout(workout, selectedExercise.id, selectedExercise.name);
      
      if (exerciseData) {
        console.log(`  ✅ Trovato esercizio "${exerciseData.name}" nell'allenamento del ${workout.date}`);
        
        // Verifica che ci siano set validi
        if (!exerciseData.sets || !Array.isArray(exerciseData.sets) || exerciseData.sets.length === 0) {
          console.warn(`  ⚠️ Nessun set valido per l'esercizio nell'allenamento del ${workout.date}`);
          continue;
        }
        
        // Calcola statistiche per questo allenamento
        let totalVolume = 0;
        let totalWeight = 0;
        let totalReps = 0;
        let validSets = 0;
        
        exerciseData.sets.forEach((set, i) => {
          const weight = parseFloat(set.weight) || 0;
          // Utilizziamo la nuova funzione per estrarre le ripetizioni da stringhe di testo
          const reps = extractRepsFromString(set.reps);
          
          if (weight <= 0 || reps <= 0) {
            console.warn(`    ⚠️ Set ${i+1}: dati non validi - peso: ${set.weight}, ripetizioni: ${set.reps} (estratto: ${reps})`);
            return; // Salta questo set
          }
          
          const setVolume = weight * reps;
          totalVolume += setVolume;
          totalWeight += weight;
          totalReps += reps;
          validSets++;
          
          console.log(`    ✅ Set ${i+1}: ${reps} reps (da "${set.reps}") x ${weight} kg = ${setVolume} kg (volume)`);
        });
        
        if (validSets === 0) {
          console.warn(`  ⚠️ Nessun set valido per l'allenamento del ${workout.date}`);
          continue;
        }
        
        const avgWeightPerRep = totalReps > 0 ? totalVolume / totalReps : 0;
        const volumePerSet = totalVolume / validSets;
        
        // Aggiungi all'array di allenamenti rilevanti
        relevantWorkoutsData.push({
          id: workout.id || `workout-${workout.date}`,
          date: new Date(workout.date).toLocaleDateString('it-IT'),
          rawDate: workout.date,
          volume: parseFloat(totalVolume.toFixed(2)),
          avgWeight: parseFloat(avgWeightPerRep.toFixed(2)),
          volumePerSet: parseFloat(volumePerSet.toFixed(2)),
          sets: validSets,
          totalReps
        });
        
        console.log(`  📈 Statistiche calcolate per l'allenamento del ${workout.date}`);
      } else {
        console.log(`  ❌ Esercizio non trovato nell'allenamento del ${workout.date}`);
      }
    }
    
    console.log(`🏋️ Trovati ${relevantWorkoutsData.length} allenamenti su ${workouts.length} per l'esercizio "${selectedExercise.name}"`);
    
    // Non ci sono allenamenti rilevanti
    if (relevantWorkoutsData.length === 0) {
      setDebugMessage(`Nessun allenamento trovato per "${selectedExercise.name}"`);
      setExerciseStats([]);
      setChartData([]);
      return;
    }
    
    // Ordinamento per data (crescente per il grafico)
    const sortedStats = relevantWorkoutsData.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
    console.log(`📊 Statistiche ordinate per grafico (dal più vecchio):`, sortedStats);
    
    // Aggiungi la linea di tendenza ai dati del grafico
    const chartDataWithTrend = calculateTrendLine(sortedStats);
    
    // Aggiorna lo stato del grafico con i dati in ordine cronologico crescente e linea di tendenza
    setChartData(chartDataWithTrend);
    
    // Crea una copia per la tabella e ordinala in ordine cronologico inverso (più recenti prima)
    const reversedStats = [...sortedStats].reverse();
    console.log(`📊 Statistiche ordinate per tabella (dal più recente):`, reversedStats);
    
    // Aggiorna lo stato per la tabella con i dati in ordine cronologico decrescente
    setExerciseStats(reversedStats);
    
    // Utilizza la nuova funzione per calcolare le statistiche in base alla metrica
    updateStatisticsBasedOnMetric(sortedStats); // Usa l'ordine originale per le statistiche
    
    console.log(`✅ Calcolo statistiche completato con successo per ${sortedStats.length} allenamenti`);
  };

  // Modifica la funzione per calcolare solo le statistiche del volume
  const updateStatisticsBasedOnMetric = (stats) => {
    if (stats.length >= 2) {
      const firstWorkout = stats[0];
      const lastWorkout = stats[stats.length - 1];
      
      // Calcoliamo solo per il volume
      const firstValue = firstWorkout.volume;
      const lastValue = lastWorkout.volume;
      
      setStartWeight(firstValue);
      setCurrentWeight(lastValue);
      setWeightIncrease(lastValue - firstValue);
      
      // Proteggersi da divisione per zero
      const percentIncrease = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
      setPercentageIncrease(percentIncrease);
      
      console.log(`📈 Progresso calcolato per volume: da ${firstValue} a ${lastValue} (${percentIncrease.toFixed(1)}%)`);
    } else if (stats.length === 1) {
      const onlyWorkout = stats[0];
      const metricValue = onlyWorkout.volume;
      
      setStartWeight(metricValue);
      setCurrentWeight(metricValue);
      setWeightIncrease(0);
      setPercentageIncrease(0);
      
      console.log(`📊 Un solo allenamento trovato, valore volume: ${metricValue}`);
    } else {
      setStartWeight(0);
      setCurrentWeight(0);
      setWeightIncrease(0);
      setPercentageIncrease(0);
      
      console.warn("⚠️ Nessun dato disponibile per il calcolo delle statistiche");
    }
  };

  // Funzione per filtrare i dati in base all'intervallo di date
  const applyDateFilter = (data) => {
    if (!data || data.length === 0 || dateRange === 'all') {
      return data;
    }
    
    const today = new Date();
    let startDate;
    
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999); // Imposta alla fine della giornata
      
      return data.filter(item => {
        const itemDate = new Date(item.rawDate);
        return itemDate >= startDate && itemDate <= endDate;
      });
    } else {
      // Filtri predefiniti: 30/90/180/365 giorni
      if (dateRange === '30') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
      } else if (dateRange === '90') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 90);
      } else if (dateRange === '180') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 180);
      } else if (dateRange === '365') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 365);
      }
      
      return data.filter(item => {
        const itemDate = new Date(item.rawDate);
        return itemDate >= startDate;
      });
    }
  };
  
  // Funzione per aggiornare gli allenamenti visibili nella tabella
  const updateVisibleWorkouts = (workouts) => {
    if (!workouts || workouts.length === 0) {
      setVisibleWorkouts([]);
      return;
    }
    
    // Filtra i workout in base allo stesso intervallo di date del grafico
    const filteredWorkouts = dateRange === 'all' ? 
      workouts : 
      applyDateFilter(workouts);
    
    // Mostra tutti o solo i primi 5
    if (showAllWorkouts) {
      setVisibleWorkouts(filteredWorkouts);
    } else {
      setVisibleWorkouts(filteredWorkouts.slice(0, 5));
    }
  };
  
  // Funzione per ricalcolare l'indice composito sui dati filtrati
  const recalculateCompositeIndex = (data) => {
    if (data.length < 2) return data;
    
    // Valori iniziali per normalizzazione
    const initialVolume = data[0].volume;
    const initialAvgWeight = data[0].avgWeight;
    const initialVolumePerSet = data[0].volumePerSet;
    
    // Ricalcola l'indice composito normalizzato per ogni punto
    return data.map((point, index) => {
      // Normalizza le metriche in percentuale rispetto al valore iniziale dell'intervallo filtrato
      const volumeNormalized = (point.volume / initialVolume) * 100;
      const avgWeightNormalized = (point.avgWeight / initialAvgWeight) * 100;
      const volumePerSetNormalized = (point.volumePerSet / initialVolumePerSet) * 100;
      
      // Media ponderata delle tre metriche con i pesi specificati:
      // - 50% peso medio per ripetizione
      // - 25% volume totale
      // - 25% volume per serie
      const compositeIndex = 
        (avgWeightNormalized * 0.5) + 
        (volumeNormalized * 0.25) + 
        (volumePerSetNormalized * 0.25);
      
      return {
        ...point,
        compositeIndex: parseFloat(compositeIndex.toFixed(1))
      };
    });
  };

  // Gestisci il cambio di intervallo di date
  const handleDateRangeChange = (range) => {
    setDateRange(range);
    // Se si seleziona un'opzione non personalizzata, resetta le date personalizzate
    if (range !== 'custom') {
      setCustomStartDate(null);
      setCustomEndDate(null);
    }
  };

  // Funzione per ottenere l'icona del gruppo muscolare
  const getMuscleGroupIcon = (group) => {
    // Utilizziamo FitnessCenterIcon per tutti i gruppi muscolari
    // Il colore verrà gestito dalla funzione getMuscleGroupColor
    return <FitnessCenterIcon sx={{ color: getMuscleGroupColor(group) }} />;
  };

  // Funzione per ottenere il colore per ogni gruppo muscolare
  const getMuscleGroupColor = (group) => {
    switch(group) {
      case 'Petto': return '#ef5350'; // rosso
      case 'Schiena': return '#42a5f5'; // blu
      case 'Gambe': return '#66bb6a'; // verde
      case 'Spalle': return '#ffb74d'; // arancione
      case 'Bicipiti': return '#ab47bc'; // viola
      case 'Tricipiti': return '#7e57c2'; // indaco
      case 'Polpacci': return '#26a69a'; // verde acqua
      case 'Addominali': return '#ffa726'; // ambra
      default: return 'primary.main';
    }
  };

  // Gestisce lo stato di caricamento iniziale degli esercizi
  if (loadingExercises) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={5}>
        <CircularProgress sx={{ mb: 3 }}/>
        <Typography>Caricamento esercizi dal database...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Intestazione della pagina */}
        <Grid item xs={12}>
          <Typography variant="h4" gutterBottom>Tracciamento Progressi</Typography>
          <Typography variant="body1" paragraph>
            Seleziona un gruppo muscolare e un esercizio per visualizzare il tuo progresso nel tempo.
          </Typography>
        </Grid>
        
        {/* 
          Stato di debug, visibile solo se ci sono problemi nei dati 
          Commentato ma conservato per debug futuro
        */}
        {/* 
        {(!dataFormat.valid || debugMessage) && (
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
              <Typography variant="subtitle1" fontWeight="bold">Stato Debug Dati:</Typography>
              <Typography variant="body2">{dataFormat.message || debugMessage}</Typography>
              
              {apiResponseData && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Formato risposta: {typeof apiResponseData === 'object' ? 'Oggetto' : typeof apiResponseData}
                  </Typography>
                  {typeof apiResponseData === 'object' && (
                    <Typography variant="caption" display="block">
                      Proprietà: {Object.keys(apiResponseData).join(', ')}
                    </Typography>
                  )}
                </Box>
              )}
            </Paper>
          </Grid>
        )}
        */}
        
        {/* Nuove Statistiche Globali */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarTodayIcon color="primary" /> Frequenza Allenamenti
              </Typography>
              <Typography variant="caption" color="text.secondary">Allenamenti per settimana (ultime 12 settimane)</Typography>
              <Box sx={{ height: 250, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={frequencyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="stepAfter" dataKey="workout_count" name="Allenamenti" stroke="#1976d2" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FitnessCenterIcon color="error" /> Volume Totale Allenamento
              </Typography>
              <Typography variant="caption" color="text.secondary">Kg totali sollevati per sessione (ultimi 3 mesi)</Typography>
              <Box sx={{ height: 250, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={totalVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateFormatted" fontSize={10} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total_volume" name="Volume (kg)" stroke="#d32f2f" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Selettori gruppo muscolare e esercizio */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper 
              elevation={2} 
              sx={{ 
                p: 3, 
                borderRadius: 2,
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(to right, rgba(250,250,250,1) 0%, rgba(245,245,245,1) 100%)'
                  : 'linear-gradient(to right, rgba(30,30,32,1) 0%, rgba(20,20,22,1) 100%)',
                boxShadow: (theme) => theme.palette.mode === 'light'
                  ? '0 3px 5px rgba(0,0,0,0.05)'
                  : '0 3px 5px rgba(0,0,0,0.3)',
                border: (theme) => theme.palette.mode === 'light' ? 'none' : '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <FitnessCenterIcon color="primary" />
                Seleziona esercizio
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom sx={{ ml: 1 }}>
                    Gruppo Muscolare
                  </Typography>
                  <FormControl 
                    fullWidth 
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: (theme) => theme.palette.mode === 'light' ? '0 3px 8px rgba(0,0,0,0.1)' : '0 3px 8px rgba(0,0,0,0.4)'
                        }
                      }
                    }}
                  >
                    <Select
                      value={selectedMuscleGroup}
                      onChange={handleMuscleGroupChange}
                      displayEmpty
                      renderValue={(selected) => {
                        if (!selected) {
                          return <Typography sx={{ color: 'text.secondary' }}>Seleziona gruppo muscolare</Typography>;
                        }
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(selected)}20` : `${getMuscleGroupColor(selected)}30`,
                              color: getMuscleGroupColor(selected)
                            }}>
                              {getMuscleGroupIcon(selected)}
                            </Box>
                            <Typography>{selected}</Typography>
                          </Box>
                        );
                      }}
                      IconComponent={ExpandMoreIcon}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            borderRadius: 2,
                            maxHeight: 300,
                            backgroundImage: 'none'
                          }
                        }
                      }}
                    >
                      {muscleGroups.map((group) => (
                        <MenuItem 
                          key={group} 
                          value={group}
                          sx={{
                            py: 1.5,
                            '&:hover': {
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(group)}10` : `${getMuscleGroupColor(group)}20`
                            },
                            '&.Mui-selected': {
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(group)}20` : `${getMuscleGroupColor(group)}30`,
                              '&:hover': {
                                bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(group)}30` : `${getMuscleGroupColor(group)}40`
                              }
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(group)}20` : `${getMuscleGroupColor(group)}30`,
                              color: getMuscleGroupColor(group)
                            }}>
                              {getMuscleGroupIcon(group)}
                            </Box>
                            <Typography>{group}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom sx={{ ml: 1 }}>
                    Esercizio
                  </Typography>
                  <FormControl 
                    fullWidth 
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        borderColor: selectedMuscleGroup ? getMuscleGroupColor(selectedMuscleGroup) : 'inherit',
                        '&:hover': {
                          boxShadow: (theme) => theme.palette.mode === 'light' ? '0 3px 8px rgba(0,0,0,0.1)' : '0 3px 8px rgba(0,0,0,0.4)'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: selectedMuscleGroup ? getMuscleGroupColor(selectedMuscleGroup) : 'primary.main'
                        }
                      }
                    }}
                  >
                    <Select
                      value={selectedExercise.id}
                      onChange={handleExerciseChange}
                      displayEmpty
                      disabled={!selectedMuscleGroup || !exercisesByMuscleGroup[selectedMuscleGroup]?.length}
                      renderValue={(selected) => {
                        if (!selected) {
                          return <Typography sx={{ color: 'text.secondary' }}>Seleziona esercizio</Typography>;
                        }
                        
                        const selectedExerciseObj = exercisesByMuscleGroup[selectedMuscleGroup]?.find(ex => ex.id === selected);
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(selectedMuscleGroup)}20` : `${getMuscleGroupColor(selectedMuscleGroup)}30`,
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: getMuscleGroupColor(selectedMuscleGroup)
                            }}>
                              {selectedExerciseObj?.name.substring(0, 2).toUpperCase()}
                            </Box>
                            <Typography>{selectedExerciseObj?.name}</Typography>
                          </Box>
                        );
                      }}
                      IconComponent={ExpandMoreIcon}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            borderRadius: 2,
                            maxHeight: 300,
                            backgroundImage: 'none'
                          }
                        }
                      }}
                    >
                      {selectedMuscleGroup && exercisesByMuscleGroup[selectedMuscleGroup]?.map((exercise) => (
                        <MenuItem 
                          key={exercise.id} 
                          value={exercise.id}
                          sx={{
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            '&:hover': {
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(selectedMuscleGroup)}10` : `${getMuscleGroupColor(selectedMuscleGroup)}20`,
                            },
                            '&.Mui-selected': {
                              bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(selectedMuscleGroup)}20` : `${getMuscleGroupColor(selectedMuscleGroup)}30`,
                              '&:hover': {
                                bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(selectedMuscleGroup)}30` : `${getMuscleGroupColor(selectedMuscleGroup)}40`
                              }
                            }
                          }}
                        >
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: (theme) => theme.palette.mode === 'light' ? `${getMuscleGroupColor(selectedMuscleGroup)}20` : `${getMuscleGroupColor(selectedMuscleGroup)}30`,
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: getMuscleGroupColor(selectedMuscleGroup)
                          }}>
                            {exercise.name.substring(0, 2).toUpperCase()}
                          </Box>
                          <Typography>{exercise.name}</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
        
        {/* Filtri temporali */}
        {chartData.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DateRangeIcon fontSize="small" />
                Intervallo di date
              </Typography>
              <Box display="flex" flexWrap="wrap" alignItems="center" gap={1}>
                <ToggleButtonGroup
                  value={dateRange}
                  exclusive
                  onChange={(e, newValue) => newValue && handleDateRangeChange(newValue)}
                  aria-label="intervallo di date"
                  size="small"
                  sx={{ 
                    flexWrap: 'wrap',
                    '& .MuiToggleButton-root': {
                      borderRadius: '4px',
                      mx: 0.3,
                      '&.Mui-selected': {
                        borderColor: 'primary.main',
                        borderWidth: 2,
                        bgcolor: 'rgba(25, 118, 210, 0.08)',
                        fontWeight: 'bold'
                      }
                    }
                  }}
                >
                  <ToggleButton value="30" aria-label="ultimi 30 giorni" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <CalendarTodayIcon fontSize="small" />
                    Ultimi 30 giorni
                  </ToggleButton>
                  <ToggleButton value="90" aria-label="ultimi 90 giorni" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <CalendarTodayIcon fontSize="small" />
                    Ultimi 90 giorni
                  </ToggleButton>
                  <ToggleButton value="180" aria-label="ultimi 180 giorni" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <CalendarTodayIcon fontSize="small" />
                    Ultimi 6 mesi
                  </ToggleButton>
                  <ToggleButton value="365" aria-label="ultimo anno" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <DateRangeIcon fontSize="small" />
                    Ultimo anno
                  </ToggleButton>
                  <ToggleButton value="all" aria-label="tutte le date" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <AllInclusiveIcon fontSize="small" />
                    Tutti i dati
                  </ToggleButton>
                  <ToggleButton value="custom" aria-label="personalizzato" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <TuneIcon fontSize="small" />
                    Personalizzato
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {dateRange === 'custom' && (
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    alignItems: 'center', 
                    gap: 2, 
                    mt: { xs: 2, md: 0 },
                    ml: { md: 2 },
                    p: 2,
                    border: '1px dashed',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    bgcolor: 'rgba(25, 118, 210, 0.04)'
                  }}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={itLocale}>
                      <DatePicker
                        label="Data inizio"
                        value={customStartDate}
                        onChange={setCustomStartDate}
                        sx={{ width: 200 }}
                        slotProps={{ 
                          textField: { 
                            size: 'small',
                            InputProps: {
                              startAdornment: (
                                <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                              )
                            }
                          } 
                        }}
                      />
                      <DatePicker
                        label="Data fine"
                        value={customEndDate}
                        onChange={setCustomEndDate}
                        sx={{ width: 200 }}
                        slotProps={{ 
                          textField: { 
                            size: 'small',
                            InputProps: {
                              startAdornment: (
                                <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                              )
                            }
                          } 
                        }}
                      />
                    </LocalizationProvider>
                  </Box>
                )}
              </Box>
              
              {/* Messaggio sul filtro applicato */}
              {filteredChartData.length < chartData.length && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Filtro applicato: visualizzazione di {filteredChartData.length} allenamenti su {chartData.length} totali.
                </Typography>
              )}
            </Paper>
          </Grid>
        )}
        
        {/* Grafico e statistiche */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h6" gutterBottom>
                Grafico Progressione
              </Typography>
              
              {chartData.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <ToggleButtonGroup
                    size="small"
                    aria-label="metriche visibili"
                    sx={{
                      '& .MuiToggleButton-root': {
                        borderRadius: '4px',
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.85rem',
                        '&.Mui-selected': {
                          fontWeight: 'bold',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }
                      }
                    }}
                  >
                    <ToggleButton 
                      value="volume" 
                      selected={visibleMetrics.volume}
                      onClick={() => setVisibleMetrics({...visibleMetrics, volume: !visibleMetrics.volume})}
                      sx={{ 
                        color: visibleMetrics.volume ? '#8884d8' : 'text.secondary',
                        bgcolor: visibleMetrics.volume ? 'rgba(136,132,216,0.1)' : 'transparent',
                        '&.Mui-selected': { 
                          bgcolor: 'rgba(136,132,216,0.1)', 
                          borderColor: '#8884d8' 
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#8884d8' }}></Box>
                        Volume Totale
                      </Box>
                    </ToggleButton>
                    <ToggleButton 
                      value="volumePerSet" 
                      selected={visibleMetrics.volumePerSet}
                      onClick={() => setVisibleMetrics({...visibleMetrics, volumePerSet: !visibleMetrics.volumePerSet})}
                      sx={{ 
                        color: visibleMetrics.volumePerSet ? '#ff9800' : 'text.secondary',
                        bgcolor: visibleMetrics.volumePerSet ? 'rgba(255,152,0,0.1)' : 'transparent',
                        '&.Mui-selected': { 
                          bgcolor: 'rgba(255,152,0,0.1)', 
                          borderColor: '#ff9800' 
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff9800' }}></Box>
                        Volume/Serie
                      </Box>
                    </ToggleButton>
                    <ToggleButton 
                      value="avgWeight" 
                      selected={visibleMetrics.avgWeight}
                      onClick={() => setVisibleMetrics({...visibleMetrics, avgWeight: !visibleMetrics.avgWeight})}
                      sx={{ 
                        color: visibleMetrics.avgWeight ? '#82ca9d' : 'text.secondary',
                        bgcolor: visibleMetrics.avgWeight ? 'rgba(130,202,157,0.1)' : 'transparent',
                        '&.Mui-selected': { 
                          bgcolor: 'rgba(130,202,157,0.1)', 
                          borderColor: '#82ca9d' 
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#82ca9d' }}></Box>
                        Peso Medio
                      </Box>
                    </ToggleButton>
                    <ToggleButton 
                      value="compositeIndex" 
                      selected={visibleMetrics.compositeIndex}
                      onClick={() => setVisibleMetrics({...visibleMetrics, compositeIndex: !visibleMetrics.compositeIndex})}
                      sx={{ 
                        color: visibleMetrics.compositeIndex ? '#9c27b0' : 'text.secondary',
                        bgcolor: visibleMetrics.compositeIndex ? 'rgba(156,39,176,0.1)' : 'transparent',
                        '&.Mui-selected': { 
                          bgcolor: 'rgba(156,39,176,0.1)', 
                          borderColor: '#9c27b0' 
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#9c27b0' }}></Box>
                        Indice Progresso
                      </Box>
                    </ToggleButton>
                    <ToggleButton 
                      value="trendLines" 
                      selected={visibleMetrics.trendLines}
                      onClick={() => setVisibleMetrics({...visibleMetrics, trendLines: !visibleMetrics.trendLines})}
                      sx={{ 
                        color: visibleMetrics.trendLines ? 'primary.main' : 'text.secondary',
                        bgcolor: visibleMetrics.trendLines ? 'rgba(25,118,210,0.1)' : 'transparent',
                        '&.Mui-selected': { 
                          bgcolor: 'rgba(25,118,210,0.1)', 
                          borderColor: 'primary.main' 
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 14, height: 2, bgcolor: 'primary.main', mx: 0.5 }}></Box>
                        Linee Tendenza
                      </Box>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              )}
            </Box>
            <Box sx={{ height: 300, width: '100%', position: 'relative' }}>
              {isLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : chartData.length === 0 ? (
                <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                  <FitnessCenterIcon sx={{ fontSize: 50, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                  <Typography align="center" color="textSecondary" variant="h6" sx={{ mb: 1 }}>
                    {debugMessage || "Nessun allenamento registrato"}
                  </Typography>
                  <Typography align="center" color="textSecondary" variant="body2">
                    {debugMessage ? "Prova con un altro esercizio" : "Seleziona un esercizio e registra il tuo primo allenamento"}
                  </Typography>
                </Box>
              ) : filteredChartData.length === 0 ? (
                <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                  <FitnessCenterIcon sx={{ fontSize: 50, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                  <Typography align="center" color="textSecondary" variant="h6" sx={{ mb: 1 }}>
                    Nessun dato nell'intervallo selezionato
                  </Typography>
                  <Typography align="center" color="textSecondary" variant="body2">
                    Prova a cambiare l'intervallo di date o a selezionare "Tutti i dati"
                  </Typography>
                </Box>
              ) : (
                <>
                  <Typography variant="caption" color="textSecondary" sx={{ mb: 1 }}>
                    {`Visualizzazione di ${filteredChartData.length} allenamenti dal ${filteredChartData[0]?.date} al ${filteredChartData[filteredChartData.length-1]?.date}`}
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={filteredChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          
                          // Filtra i payload per rimuovere le linee di tendenza
                          const filteredPayload = payload.filter(p => !p.name.includes("Tendenza"));
                          
                          if (filteredPayload.length === 0) return null;
                          
                          return (
                            <div style={{ 
                              backgroundColor: 'white', 
                              padding: '10px', 
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{label}</p>
                              {filteredPayload.map((entry, index) => {
                                let valueDisplay = `${entry.value}`;
                                let nameDisplay = entry.name;
                                
                                if (entry.name === "Volume Totale") {
                                  valueDisplay = `${entry.value} kg`;
                                } else if (entry.name === "Peso Medio") {
                                  valueDisplay = `${entry.value} kg/rep`;
                                } else if (entry.name === "Indice di Progresso") {
                                  valueDisplay = `${entry.value} (base 100)`;
                                } else if (entry.name === "Volume Medio per Serie") {
                                  valueDisplay = `${entry.value} kg/serie`;
                                }
                                
                                return (
                                  <p key={`tooltip-${index}`} style={{ 
                                    margin: '3px 0',
                                    color: entry.color
                                  }}>
                                    <span style={{ 
                                      display: 'inline-block', 
                                      width: '10px', 
                                      height: '10px', 
                                      backgroundColor: entry.color,
                                      marginRight: '5px'
                                    }}></span>
                                    {nameDisplay}: {valueDisplay}
                                  </p>
                                );
                              })}
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      {visibleMetrics.volume && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="volume"
                          name="Volume Totale"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                        />
                      )}
                      {visibleMetrics.avgWeight && (
                        <Line
                          yAxisId="right" 
                          type="monotone"
                          dataKey="avgWeight"
                          name="Peso Medio"
                          stroke="#82ca9d"
                          activeDot={{ r: 6 }}
                        />
                      )}
                      {visibleMetrics.volumePerSet && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="volumePerSet"
                          name="Volume Medio per Serie"
                          stroke="#ff9800"
                          activeDot={{ r: 6 }}
                        />
                      )}
                      {visibleMetrics.trendLines && visibleMetrics.volume && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="trendVolume"
                          name="Linea di Tendenza Volume"
                          stroke="#8884d8"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={false}
                          strokeDasharray="5 5"
                        />
                      )}
                      {visibleMetrics.trendLines && visibleMetrics.avgWeight && (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="trendAvgWeight"
                          name="Linea di Tendenza Peso Medio"
                          stroke="#82ca9d"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={false}
                          strokeDasharray="5 5"
                        />
                      )}
                      {visibleMetrics.trendLines && visibleMetrics.volumePerSet && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="trendVolumePerSet"
                          name="Linea di Tendenza Volume per Serie"
                          stroke="#ff9800"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={false}
                          strokeDasharray="5 5"
                        />
                      )}
                      {visibleMetrics.compositeIndex && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="compositeIndex"
                          name="Indice di Progresso"
                          stroke="#9c27b0"
                          strokeWidth={3}
                          activeDot={{ r: 8 }}
                        />
                      )}
                      {visibleMetrics.trendLines && visibleMetrics.compositeIndex && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="trendComposite"
                          name="Linea di Tendenza Progresso"
                          stroke="#9c27b0"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          dot={false}
                          activeDot={false}
                          strokeDasharray="5 5"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </Box>
            
            {/* Statistiche di progresso in orizzontale */}
            {chartData.length > 0 && filteredChartData.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ mb: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Statistiche Progresso
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  {/* Volume Totale */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 1, 
                      bgcolor: 'background.default',
                      height: '100%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: '4px solid #8884d8'
                    }}>
                      <Typography variant="subtitle2" color="#8884d8" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Volume Totale
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Iniziale:</Typography>
                        <Typography variant="body2" fontWeight="medium">{startWeight.toFixed(1)} kg</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Attuale:</Typography>
                        <Typography variant="body2" fontWeight="medium">{currentWeight.toFixed(1)} kg</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Incremento:</Typography>
                        <Typography variant="body2" fontWeight="bold" color={weightIncrease >= 0 ? 'success.main' : 'error.main'}>
                          {weightIncrease >= 0 ? '+' : ''}{weightIncrease.toFixed(1)} kg ({percentageIncrease.toFixed(1)}%)
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  {/* Volume Medio per Serie */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 1, 
                      bgcolor: 'background.default',
                      height: '100%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: '4px solid #ff9800'
                    }}>
                      <Typography variant="subtitle2" color="#ff9800" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Volume Medio per Serie
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Iniziale:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {filteredChartData[0].volumePerSet.toFixed(1)} kg/serie
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Attuale:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {filteredChartData[filteredChartData.length - 1].volumePerSet.toFixed(1)} kg/serie
                        </Typography>
                      </Box>
                      {filteredChartData.length >= 2 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Incremento:</Typography>
                          {(() => {
                            const firstValue = filteredChartData[0].volumePerSet;
                            const lastValue = filteredChartData[filteredChartData.length - 1].volumePerSet;
                            const increase = lastValue - firstValue;
                            const percentIncrease = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
                            return (
                              <Typography variant="body2" fontWeight="bold" color={increase >= 0 ? 'success.main' : 'error.main'}>
                                {increase >= 0 ? '+' : ''}{increase.toFixed(1)} kg/serie ({percentIncrease.toFixed(1)}%)
                              </Typography>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  
                  {/* Peso Medio */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 1, 
                      bgcolor: 'background.default',
                      height: '100%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      borderLeft: '4px solid #82ca9d'
                    }}>
                      <Typography variant="subtitle2" color="#82ca9d" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Peso Medio
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Iniziale:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {filteredChartData[0].avgWeight.toFixed(1)} kg/rep
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">Attuale:</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {filteredChartData[filteredChartData.length - 1].avgWeight.toFixed(1)} kg/rep
                        </Typography>
                      </Box>
                      {filteredChartData.length >= 2 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Incremento:</Typography>
                          {(() => {
                            const firstValue = filteredChartData[0].avgWeight;
                            const lastValue = filteredChartData[filteredChartData.length - 1].avgWeight;
                            const increase = lastValue - firstValue;
                            const percentIncrease = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
                            return (
                              <Typography variant="body2" fontWeight="bold" color={increase >= 0 ? 'success.main' : 'error.main'}>
                                {increase >= 0 ? '+' : ''}{increase.toFixed(1)} kg/rep ({percentIncrease.toFixed(1)}%)
                              </Typography>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  
                  {/* Indice Composito */}
                  {filteredChartData.length >= 2 && (
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        borderRadius: 1, 
                        bgcolor: 'background.default',
                        height: '100%',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        borderLeft: '4px solid #9c27b0'
                      }}>
                        <Typography variant="subtitle2" color="#9c27b0" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Indice di Progresso
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">Iniziale:</Typography>
                          <Typography variant="body2" fontWeight="medium">100 (base)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">Attuale:</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {filteredChartData[filteredChartData.length - 1].compositeIndex.toFixed(1)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Incremento:</Typography>
                          {(() => {
                            const firstValue = 100;
                            const lastValue = filteredChartData[filteredChartData.length - 1].compositeIndex;
                            const increase = lastValue - firstValue;
                            return (
                              <Typography variant="body2" fontWeight="bold" color={increase >= 0 ? 'success.main' : 'error.main'}>
                                {increase >= 0 ? '+' : ''}{increase.toFixed(1)} punti ({increase.toFixed(1)}%)
                              </Typography>
                            );
                          })()}
                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </>
            )}
            
            {/* Messaggio per nessun dato */}
            {chartData.length === 0 && (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" p={2}>
                <FitnessCenterIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2, opacity: 0.6 }} />
                <Typography align="center" color="textSecondary" variant="subtitle1">
                  {debugMessage || "Nessun dato di allenamento disponibile"}
                </Typography>
                <Typography align="center" color="textSecondary" variant="body2" sx={{ mt: 1 }}>
                  Registra un allenamento con questo esercizio per vedere i tuoi progressi
                </Typography>
              </Box>
            )}
            
            {/* Messaggio per nessun dato nell'intervallo */}
            {chartData.length > 0 && filteredChartData.length === 0 && (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" p={2}>
                <FitnessCenterIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2, opacity: 0.6 }} />
                <Typography align="center" color="textSecondary" variant="subtitle1">
                  Nessun dato nell'intervallo selezionato
                </Typography>
                <Typography align="center" color="textSecondary" variant="body2" sx={{ mt: 1 }}>
                  Prova a cambiare l'intervallo di date
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Dettaglio allenamenti */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Dettaglio Allenamenti - {selectedExercise.name}
              </Typography>
              
              {exerciseStats.length > 5 && (
                <Button 
                  size="small" 
                  endIcon={showAllWorkouts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setShowAllWorkouts(!showAllWorkouts)}
                >
                  {showAllWorkouts ? "Mostra meno" : "Mostra tutti"}
                </Button>
              )}
            </Box>
            
            {isLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : visibleWorkouts.length === 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" p={4}>
                <FitnessCenterIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2, opacity: 0.6 }} />
                <Typography align="center" color="textSecondary" variant="h6">
                  {debugMessage || "Nessun dato di allenamento disponibile"}
                </Typography>
                <Typography align="center" color="textSecondary" variant="body2" sx={{ mt: 1 }}>
                  {dateRange !== 'all' ? 
                    "Prova a cambiare l'intervallo di date o seleziona 'Tutti i dati'" : 
                    "Registra un allenamento con questo esercizio per vedere i tuoi progressi"
                  }
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell align="right">Set</TableCell>
                        <TableCell align="right">Ripetizioni totali</TableCell>
                        <TableCell align="right">Volume totale (kg)</TableCell>
                        <TableCell align="right">Peso medio (kg/rep)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibleWorkouts.map((stat) => (
                        <TableRow key={stat.id}>
                          <TableCell component="th" scope="row">{stat.date}</TableCell>
                          <TableCell align="right">{stat.sets}</TableCell>
                          <TableCell align="right">{stat.totalReps}</TableCell>
                          <TableCell align="right">{stat.volume.toFixed(1)}</TableCell>
                          <TableCell align="right">{stat.avgWeight}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                {/* Mostra un testo informativo se ci sono più righe da visualizzare */}
                {!showAllWorkouts && exerciseStats.length > 5 && (
                  <Box textAlign="center" mt={2}>
                    <Typography variant="body2" color="text.secondary">
                      Visualizzazione di {visibleWorkouts.length} su {exerciseStats.length} allenamenti
                    </Typography>
                  </Box>
                )}
              </>
            )}
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
    </Container>
  );
};

export default Progress;
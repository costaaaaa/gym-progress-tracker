import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  FormControl,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Card,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  useTheme,
} from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { API_BASE_URL } from '../config';
import { extractReps, estimateOneRepMax } from '../utils/workoutMetrics';
import ChartCard from '../components/ChartCard';

// Le tre metriche selezionabili tramite pill nella toolbar del grafico principale.
// dataKey/secondaryKey sono già presenti in ogni punto di chartData (vedi calculateTrendLine).
const METRIC_OPTIONS = [
  {
    key: 'avgWeight', label: 'Peso Medio', unit: 'kg/rep', color: '#d50000',
    secondaryKey: 'est1RM', secondaryLabel: 'Stima 1RM (kg)', secondaryColor: '#4f46e5',
  },
  {
    key: 'volume', label: 'Volume Totale', unit: 'kg', color: '#d50000',
    secondaryKey: 'volumePerSet', secondaryLabel: 'Volume medio per serie (kg)', secondaryColor: '#4f46e5',
  },
  {
    key: 'compositeIndex', label: 'Indice di Progresso', unit: '', color: '#7c3aed',
    secondaryKey: 'trendComposite', secondaryLabel: 'Linea di tendenza', secondaryColor: '#7c3aed', secondaryOpacity: 0.4,
  },
];

const renderChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>{label}</Typography>
      {payload.map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: entry.color }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {entry.name}: <strong>{entry.value}</strong>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// Pastiglia 16×3 arrotondata + etichetta, sostituisce il <Legend> di default di recharts.
const LegendSwatch = ({ color, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box sx={{ width: 16, height: 3, borderRadius: '2px', bgcolor: color }} />
    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
  </Box>
);

const formatDelta = (first, last) => {
  if (first === undefined || last === undefined || first === 0) return null;
  const pct = ((last - first) / first) * 100;
  return { pct, up: pct >= 0 };
};

const Progress = ({ isEmbedded = false }) => {
  const theme = useTheme();
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [exercisesByMuscleGroup, setExercisesByMuscleGroup] = useState({});
  const [loadingExercises, setLoadingExercises] = useState(true);

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');
  const [selectedExercise, setSelectedExercise] = useState({ id: '', name: '' });
  const [selectedMetric, setSelectedMetric] = useState('avgWeight');

  const [chartData, setChartData] = useState([]);
  const [exerciseStats, setExerciseStats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);

  const [frequencyData, setFrequencyData] = useState([]);
  const [totalVolumeData, setTotalVolumeData] = useState([]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const fetchGlobalStats = async () => {
    try {
      const [freqRes, volRes] = await Promise.all([
        fetch(`${API_BASE_URL}api/workout_stats/frequency.php`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}api/workout_stats/volume.php`, { credentials: 'include' }),
      ]);
      const freqData = await freqRes.json();
      const volData = await volRes.json();

      if (freqData.records) {
        setFrequencyData(freqData.records.map(r => ({
          ...r,
          label: `Sett. ${r.year_week.toString().slice(-2)}`,
        })));
      }
      if (volData.records) {
        setTotalVolumeData(volData.records.map(r => ({
          ...r,
          dateFormatted: new Date(r.workout_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        })));
      }
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche globali:', error);
    }
  };

  useEffect(() => {
    fetchExercises();
    fetchGlobalStats();
  }, []);

  useEffect(() => {
    if (!loadingExercises && muscleGroups.length > 0) {
      setSelectedMuscleGroup(muscleGroups[0]);
    }
  }, [loadingExercises, muscleGroups]);

  useEffect(() => {
    const exercises = exercisesByMuscleGroup[selectedMuscleGroup];
    if (selectedMuscleGroup && exercises && exercises.length > 0) {
      setSelectedExercise({ id: exercises[0].id, name: exercises[0].name });
    }
  }, [selectedMuscleGroup, exercisesByMuscleGroup]);

  useEffect(() => {
    if (selectedExercise.id && selectedExercise.name) {
      fetchWorkoutHistory();
    }
  }, [selectedExercise]);

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

  const fetchExercises = async () => {
    setLoadingExercises(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/exercise/read_all.php`, {
        method: 'GET',
        credentials: 'include',
      });
      const data = await response.json();

      if (data.records && Array.isArray(data.records)) {
        const uniqueGroups = [...new Set(data.records.map(ex => capitalize(ex.muscle_group)))]
          .filter(Boolean)
          .sort();
        setMuscleGroups(uniqueGroups);

        const exercisesByGroup = {};
        uniqueGroups.forEach(group => { exercisesByGroup[group] = []; });
        data.records.forEach(exercise => {
          const group = capitalize(exercise.muscle_group);
          if (group && uniqueGroups.includes(group)) {
            exercisesByGroup[group].push({ id: exercise.id, name: exercise.name });
          }
        });
        setExercisesByMuscleGroup(exercisesByGroup);
      } else {
        setMuscleGroups([]);
        setExercisesByMuscleGroup({});
        setSnackbar({ open: true, message: 'Non sono stati trovati esercizi nel database', severity: 'warning' });
      }
    } catch (error) {
      console.error('Errore nel caricamento degli esercizi:', error);
      setSnackbar({ open: true, message: 'Errore nel caricamento degli esercizi', severity: 'error' });
      setMuscleGroups([]);
      setExercisesByMuscleGroup({});
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleMuscleGroupChange = (event) => setSelectedMuscleGroup(event.target.value);

  const handleExerciseChange = (event) => {
    const exerciseId = event.target.value;
    const exercise = exercisesByMuscleGroup[selectedMuscleGroup]?.find(ex => ex.id === exerciseId);
    if (exercise) {
      setSelectedExercise({ id: exercise.id, name: exercise.name });
      setChartData([]);
      setExerciseStats([]);
    }
  };

  // Trova l'esercizio selezionato in un allenamento: prima per ID, poi per nome esatto come fallback.
  const findExerciseInWorkout = (workout, exerciseId, exerciseName) => {
    if (!workout?.exercises || !Array.isArray(workout.exercises)) return null;

    if (exerciseId) {
      const byId = workout.exercises.find(ex => ex.exercise_id && String(ex.exercise_id).trim() === String(exerciseId).trim());
      if (byId) return byId;
    }
    if (exerciseName) {
      const normalized = exerciseName.trim().toLowerCase();
      const byName = workout.exercises.find(ex => ex.name && ex.name.trim().toLowerCase() === normalized);
      if (byName) return byName;
    }
    return null;
  };

  const fetchWorkoutHistory = async () => {
    setIsLoading(true);
    setEmptyMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}api/workout_history/read.php`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

      const data = await response.json();
      if (!data.records || !Array.isArray(data.records)) {
        setChartData([]);
        setExerciseStats([]);
        return;
      }

      const sortedWorkouts = data.records.sort((a, b) => new Date(a.date) - new Date(b.date));
      calculateExerciseStats(sortedWorkouts);
    } catch (error) {
      console.error('Errore nel caricamento della cronologia:', error);
      const message = error.message.includes('404')
        ? 'Nessun dato di allenamento disponibile. Registra il tuo primo allenamento!'
        : 'Errore nel caricamento della cronologia: problema di connessione';
      setEmptyMessage(message);
      setChartData([]);
      setExerciseStats([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Regressione lineare (per la linea di tendenza dell'Indice di Progresso).
  const calculateRegression = (data, valueKey) => {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach((point, index) => {
      sumX += index;
      sumY += point[valueKey];
      sumXY += index * point[valueKey];
      sumXX += index * index;
    });
    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;
    return { m, b };
  };

  const calculateTrendLine = (data) => {
    if (data.length < 2) {
      return data.map(point => ({ ...point, compositeIndex: 100, trendComposite: 100 }));
    }

    const initialVolume = data[0].volume;
    const initialAvgWeight = data[0].avgWeight;
    const initialVolumePerSet = data[0].volumePerSet;

    // Indice di Progresso: media ponderata di peso medio (50%), volume (25%), volume/serie (25%),
    // ciascuno normalizzato al 100% del primo punto della serie.
    const withComposite = data.map(point => {
      const volumeNorm = (point.volume / initialVolume) * 100;
      const avgWeightNorm = (point.avgWeight / initialAvgWeight) * 100;
      const volumePerSetNorm = (point.volumePerSet / initialVolumePerSet) * 100;
      const compositeIndex = avgWeightNorm * 0.5 + volumeNorm * 0.25 + volumePerSetNorm * 0.25;
      return { ...point, compositeIndex: parseFloat(compositeIndex.toFixed(1)) };
    });

    const compositeRegression = calculateRegression(withComposite, 'compositeIndex');

    return withComposite.map((point, index) => ({
      ...point,
      trendComposite: parseFloat((compositeRegression.m * index + compositeRegression.b).toFixed(1)),
    }));
  };

  const calculateExerciseStats = (workouts) => {
    if (!workouts || workouts.length === 0 || !selectedExercise.id) {
      setExerciseStats([]);
      setChartData([]);
      return;
    }

    const relevant = [];
    for (const workout of workouts) {
      const exerciseData = findExerciseInWorkout(workout, selectedExercise.id, selectedExercise.name);
      if (!exerciseData?.sets?.length) continue;

      let totalVolume = 0, totalReps = 0, validSets = 0, bestOneRM = 0;
      exerciseData.sets.forEach((set) => {
        const weight = parseFloat(set.weight) || 0;
        const reps = extractReps(set.reps);
        if (weight <= 0 || reps <= 0) return;

        totalVolume += weight * reps;
        totalReps += reps;
        validSets++;
        bestOneRM = Math.max(bestOneRM, estimateOneRepMax(weight, reps));
      });
      if (validSets === 0) continue;

      relevant.push({
        id: workout.id || `workout-${workout.date}`,
        date: new Date(workout.date).toLocaleDateString('it-IT'),
        rawDate: workout.date,
        volume: parseFloat(totalVolume.toFixed(2)),
        avgWeight: parseFloat((totalVolume / totalReps).toFixed(2)),
        volumePerSet: parseFloat((totalVolume / validSets).toFixed(2)),
        est1RM: parseFloat(bestOneRM.toFixed(1)),
        totalReps,
      });
    }

    if (relevant.length === 0) {
      setEmptyMessage(`Nessun allenamento trovato per "${selectedExercise.name}"`);
      setExerciseStats([]);
      setChartData([]);
      return;
    }

    const ascending = relevant.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
    setChartData(calculateTrendLine(ascending));
    setExerciseStats([...ascending].reverse());
  };

  const metric = METRIC_OPTIONS.find(m => m.key === selectedMetric);
  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const visibleRows = showAllRows ? exerciseStats : exerciseStats.slice(0, 5);

  const statCards = [
    { label: 'Volume Totale', unit: 'kg', value: last?.volume, delta: formatDelta(first?.volume, last?.volume) },
    { label: 'Peso Medio', unit: 'kg/rep', value: last?.avgWeight, delta: formatDelta(first?.avgWeight, last?.avgWeight) },
    { label: 'Indice di Progresso', unit: '', value: last?.compositeIndex, delta: formatDelta(first?.compositeIndex, last?.compositeIndex) },
  ];

  const renderContent = () => (
    <Grid container spacing={3}>
      {!isEmbedded && (
        <Grid item xs={12}>
          <Typography variant="h4" gutterBottom>Tracciamento Progressi</Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Seleziona un gruppo muscolare e un esercizio per visualizzare il tuo progresso nel tempo.
          </Typography>
        </Grid>
      )}

      {/* Frequenza / Volume totale */}
      <Grid item xs={12} md={6}>
        <ChartCard
          title="Frequenza Allenamenti"
          data={frequencyData.map(r => r.workout_count)}
          color="#d50000"
          valueLabel={frequencyData.length ? `${frequencyData[frequencyData.length - 1].workout_count}` : '—'}
          deltaText={frequencyData.length ? `${frequencyData.length} settimane monitorate` : undefined}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <ChartCard
          title="Volume Totale Allenamento"
          data={totalVolumeData.map(r => r.total_volume)}
          color="#4f46e5"
          valueLabel={totalVolumeData.length ? `${Math.round(totalVolumeData[totalVolumeData.length - 1].total_volume).toLocaleString()} kg` : '—'}
          deltaText={totalVolumeData.length ? `${totalVolumeData.length} sessioni registrate` : undefined}
        />
      </Grid>

      {/* Toolbar: selettori + pill metrica */}
      <Grid item xs={12}>
        <Card sx={{ p: '20px 22px' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select value={selectedMuscleGroup} onChange={handleMuscleGroupChange} displayEmpty disabled={loadingExercises}>
                {muscleGroups.map(group => <MenuItem key={group} value={group}>{group}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select value={selectedExercise.id} onChange={handleExerciseChange} displayEmpty disabled={loadingExercises || !selectedMuscleGroup}>
                {(exercisesByMuscleGroup[selectedMuscleGroup] || []).map(ex => (
                  <MenuItem key={ex.id} value={ex.id}>{ex.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <ToggleButtonGroup
              exclusive
              value={selectedMetric}
              onChange={(e, v) => v && setSelectedMetric(v)}
              sx={{
                ml: { md: 'auto' },
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  borderRadius: '999px !important',
                  border: '1px solid',
                  borderColor: 'divider',
                  px: 2,
                  py: 0.75,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'text.secondary',
                  mr: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: '#fff',
                    borderColor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                },
              }}
            >
              {METRIC_OPTIONS.map(opt => (
                <ToggleButton key={opt.key} value={opt.key}>{opt.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : chartData.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ color: 'text.secondary' }}>
                {emptyMessage || 'Nessun allenamento registrato per questo esercizio'}
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid horizontal vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="date" fontSize={11} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} tickCount={4} width={40} />
                    <Tooltip content={renderChartTooltip} />
                    <Line type="monotone" dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line
                      type="monotone"
                      dataKey={metric.secondaryKey}
                      name={metric.secondaryLabel}
                      stroke={metric.secondaryColor}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      strokeOpacity={metric.secondaryOpacity ?? 1}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
                <LegendSwatch color={metric.color} label={metric.label} />
                <LegendSwatch color={metric.secondaryColor} label={metric.secondaryLabel} />
              </Box>
            </>
          )}
        </Card>
      </Grid>

      {/* Stat card */}
      {chartData.length > 0 && statCards.map((card) => (
        <Grid item xs={12} sm={4} key={card.label}>
          <Card sx={{ p: '20px 22px', height: '100%' }}>
            <Typography sx={{ textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 1 }}>
              {card.label}
            </Typography>
            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 26 }}>
              {card.value?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—'}
              {card.unit && <Box component="span" sx={{ fontSize: 13, fontWeight: 600, ml: 0.5 }}>{card.unit}</Box>}
            </Typography>
            {card.delta && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: card.delta.up ? 'success.main' : 'error.main', mt: 0.5 }}>
                {card.delta.up ? '▲' : '▼'} {Math.abs(card.delta.pct).toFixed(1)}% vs prima rilevazione
              </Typography>
            )}
          </Card>
        </Grid>
      ))}

      {/* Cronologia */}
      {exerciseStats.length > 0 && (
        <Grid item xs={12}>
          <Card sx={{ p: '20px 22px' }}>
            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 15, mb: 2 }}>
              Cronologia — {selectedExercise.name}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700, border: 0 }}>Data</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700, border: 0 }}>Volume totale (kg)</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700, border: 0 }}>Peso medio (kg/rep)</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700, border: 0 }}>Ripetizioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((row, i) => {
                    const isLast = i === visibleRows.length - 1;
                    const cellSx = { fontSize: 13, borderColor: 'divider', ...(isLast ? { border: 0 } : {}) };
                    return (
                      <TableRow key={row.id}>
                        <TableCell sx={cellSx}>{row.date}</TableCell>
                        <TableCell align="right" sx={{ ...cellSx, fontWeight: 700 }}>{row.volume.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={cellSx}>{row.avgWeight.toFixed(1)}</TableCell>
                        <TableCell align="right" sx={cellSx}>{row.totalReps}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {exerciseStats.length > 5 && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button size="small" onClick={() => setShowAllRows(!showAllRows)} sx={{ fontSize: 13 }}>
                  {showAllRows ? 'Mostra meno' : `Mostra tutti (${exerciseStats.length})`}
                </Button>
              </Box>
            )}
          </Card>
        </Grid>
      )}
    </Grid>
  );

  return (
    <>
      {isEmbedded ? (
        <Box sx={{ py: 2 }}>{renderContent()}</Box>
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>{renderContent()}</Container>
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

export default Progress;

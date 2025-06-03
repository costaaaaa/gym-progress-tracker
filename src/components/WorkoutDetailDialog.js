import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Divider,
  List,
  ListItem,
  Box,
  Chip,
  Grid,
  Paper,
  Alert
} from '@mui/material';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const WorkoutDetailDialog = ({ open, onClose, workout }) => {
  useEffect(() => {
    if (workout) {
      console.log("🔍 Dettagli allenamento ricevuti:", workout);
      console.log("📊 Struttura esercizi:", workout.exercises);
    }
  }, [workout]);

  if (!workout) return null;

  // Determina il formato dei dati e organizza gli esercizi di conseguenza
  const organizeExercises = (exercises) => {
    if (!Array.isArray(exercises)) {
      console.warn("❌ Gli esercizi non sono in un array:", exercises);
      return [];
    }
    console.log(`📋 Organizzazione di ${exercises.length} esercizi`);
    
    // Soluzione DRASTICA: manteniamo la sequenza ESATTA originale senza raggruppare
    // Questo dovrebbe risolvere definitivamente il problema dell'ordine
    // Cloniamo l'array degli esercizi per non modificare l'originale
    const exercisesCopy = [...exercises];
    
    // Trasformiamo i dati in un formato uniforme
    const formattedExercises = exercisesCopy.map((exercise, index) => {
      // Creiamo una copia profonda dell'esercizio
      const exerciseCopy = JSON.parse(JSON.stringify(exercise));
      
      // Aggiungiamo proprietà di debug
      exerciseCopy._originalIndex = index;
      
      // Determina l'ID dell'esercizio
      exerciseCopy.id = exercise.exercise_id ||
        (exercise.name ? `temp-${exercise.name.toLowerCase().replace(/\s+/g, '-')}` : `unknown-${index}`);
      
      // Determina il nome dell'esercizio
      exerciseCopy.name = exercise.exercise_name || exercise.name || 'Esercizio senza nome';
      
      // Uniformiamo il formato dei set
      if (!exerciseCopy.sets) {
        exerciseCopy.sets = [{
          set_number: exercise.set_number || 1,
          weight: exercise.weight || 0,
          reps: exercise.reps || 0
        }];
      }
      
      return exerciseCopy;
    });
    
    console.log("✅ Esercizi formattati MANTENENDO L'ORDINE ORIGINALE ESATTO:", formattedExercises);
    console.log("📝 Nomi esercizi nell'ordine finale:", formattedExercises.map(e => e.name));
    
    return formattedExercises;
  };

  // Organizza gli esercizi
  const exercisesByType = organizeExercises(workout.exercises);

  // Controlla se ci sono esercizi
  const hasExercises = exercisesByType.length > 0;

  const formattedDate = workout.date
    ? format(new Date(workout.date), 'EEEE d MMMM yyyy, HH:mm', { locale: it })
    : 'Data non disponibile';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
          Dettaglio Allenamento
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
          {formattedDate}
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 3 }}>
        {/* Debug Info - visibile solo quando ci sono problemi */}
        {workout.exercises && workout.exercises.length > 0 && !hasExercises && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Informazioni di debug:
            </Typography>
            <Typography variant="body2">
              L'allenamento contiene {workout.exercises.length} esercizi, ma non è stato possibile visualizzarne i dettagli.
              Questo potrebbe essere dovuto a un problema di compatibilità con il nuovo formato del database.
            </Typography>
          </Alert>
        )}

        {workout.notes && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Note:</Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', mt: 1 }}>
              <Typography variant="body2">{workout.notes}</Typography>
            </Paper>
          </Box>
        )}

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Esercizi ({hasExercises ? exercisesByType.length : 0})
        </Typography>

        {!hasExercises ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Nessun dettaglio disponibile per questo allenamento
          </Alert>
        ) : (
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
            <List>
              {exercisesByType.map((exercise, index) => (
                <React.Fragment key={exercise.id + "-" + index}>
                  {index > 0 && <Divider component="li" />}
                  <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                        {exercise.name}
                      </Typography>
                      <Chip
                        label={`${exercise.sets.length} serie`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>

                    {exercise.sets.length > 0 ? (
                      <Grid container spacing={2} sx={{ width: '100%' }}>
                        <Grid item xs={12}>
                          <Paper variant="outlined" sx={{ borderRadius: 1 }}>
                            <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderTopLeftRadius: 1, borderTopRightRadius: 1 }}>
                              <Grid container>
                                <Grid item xs={2}>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Serie</Typography>
                                </Grid>
                                <Grid item xs={5}>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Peso (kg)</Typography>
                                </Grid>
                                <Grid item xs={5}>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Ripetizioni</Typography>
                                </Grid>
                              </Grid>
                            </Box>
                            <Divider />
                            {exercise.sets.map((set, idx) => (
                              <Box key={idx} sx={{ px: 2, py: 1.5 }}>
                                <Grid container alignItems="center">
                                  <Grid item xs={2}>
                                    <Typography variant="body2">{set.set_number || idx + 1}</Typography>
                                  </Grid>
                                  <Grid item xs={5}>
                                    <Typography variant="body2">{set.weight || 0}</Typography>
                                  </Grid>
                                  <Grid item xs={5}>
                                    <Typography variant="body2" color="text.secondary">
                                      {set.weight} kg x {set.reps} reps
                                    </Typography>
                                    {exercise.notes && (
                                      <Box mt={1} sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                          Note: {exercise.notes}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Grid>
                                </Grid>
                              </Box>
                            ))}
                          </Paper>
                        </Grid>
                      </Grid>
                    ) : (
                      <Alert severity="warning" sx={{ width: '100%' }}>
                        Nessun dettaglio disponibile per questo esercizio
                      </Alert>
                    )}
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Chiudi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkoutDetailDialog;
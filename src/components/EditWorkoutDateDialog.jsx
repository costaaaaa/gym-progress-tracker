import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Box,
  Typography
} from '@mui/material';
import { format, parseISO, isValid } from 'date-fns';
import { API_BASE_URL } from '../config';

const EditWorkoutDateDialog = ({ open, onClose, workout, onUpdateSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newDate, setNewDate] = useState('');

  // Reinizializza la data quando cambia il workout
  useEffect(() => {
    if (workout) {
      console.log("Data originale dell'allenamento:", workout.date);
      
      // Gestione più robusta della data
      try {
        let dateObj;
        
        // Se la data è una stringa ISO, usiamo parseISO per una gestione più sicura
        if (typeof workout.date === 'string' && workout.date.includes('T')) {
          dateObj = parseISO(workout.date);
        } else {
          // Altrimenti proviamo a usare il costruttore Date standard
          dateObj = new Date(workout.date);
        }
        
        // Verifica che la data sia valida
        if (isValid(dateObj)) {
          const formattedDate = format(dateObj, 'yyyy-MM-dd');
          console.log("Data formattata per l'input:", formattedDate);
          setNewDate(formattedDate);
        } else {
          // Se la data non è valida, prendiamo la data corrente
          console.warn("Data non valida, uso la data corrente");
          setNewDate(format(new Date(), 'yyyy-MM-dd'));
          setError("Il formato della data originale non è valido. Impostata data odierna.");
        }
      } catch (e) {
        // Gestione errori più dettagliata
        console.error("Errore nel formato della data:", e);
        setNewDate(format(new Date(), 'yyyy-MM-dd'));
        setError("Impossibile interpretare la data originale. Impostata data odierna.");
      }
    }
  }, [workout]);

  const handleDateChange = (e) => {
    setNewDate(e.target.value);
    setError(''); // Puliamo eventuali errori quando l'utente modifica la data
  };

  const handleSubmit = async () => {
    if (!newDate) {
      setError('Inserire una data valida');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log("Invio aggiornamento data:", newDate);
      
      const response = await fetch(`${API_BASE_URL}api/workout_history/update_date.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: workout.id,
          new_date: newDate
        }),
        credentials: 'include'
      });

      const data = await response.json();
      console.log("Risposta dal server:", data);

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante l\'aggiornamento della data');
      }

      // Chiamiamo il callback per informare il parent del successo
      // Utilizziamo la data restituita dal server che è in formato ISO completo
      onUpdateSuccess(workout.id, data.new_date || newDate);
      onClose();
    } catch (error) {
      console.error("Errore nell'aggiornamento della data:", error);
      setError(error.message || 'Si è verificato un errore durante l\'aggiornamento della data');
    } finally {
      setLoading(false);
    }
  };

  // Se non c'è un workout selezionato, non mostriamo il dialog
  if (!workout) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Modifica Data Allenamento</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body1">
            Data attuale: {
              (() => {
                try {
                  // Mostra la data in formato leggibile italiano
                  const dateObj = new Date(workout.date);
                  if (isValid(dateObj)) {
                    return dateObj.toLocaleDateString('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                  } else {
                    return workout.date || 'Data non disponibile';
                  }
                } catch (e) {
                  return workout.date || 'Data non disponibile';
                }
              })()
            }
          </Typography>
          <TextField
            label="Nuova data"
            type="date"
            value={newDate}
            onChange={handleDateChange}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Annulla
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !newDate}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Aggiornamento...' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditWorkoutDateDialog; 
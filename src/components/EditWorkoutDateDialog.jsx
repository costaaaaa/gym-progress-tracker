import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { format, parseISO, isValid, subDays } from 'date-fns';
import { API_BASE_URL } from '../config';
import { intlLocale } from '../i18n/format';
import { achievementCatalog } from '../utils/gamificationLevels';

const achievementLabel = (key) => achievementCatalog.find(a => a.key === key)?.label ?? key;

// Codici d'errore di update_date.php → testo tradotto (il message del server è solo in italiano)
const ERROR_KEYS = {
  missing_data: 'history.date.required',
  invalid_date: 'history.date.error_invalid',
  future_date: 'history.date.error_future',
  target_too_old: 'history.date.error_target_too_old',
  source_too_old: 'history.date.too_old',
  not_found: 'history.date.error_not_found',
};

const EditWorkoutDateDialog = ({ open, onClose, workout, onUpdateSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newDate, setNewDate] = useState('');
  const [originalDate, setOriginalDate] = useState('');
  const [preview, setPreview] = useState(null); // cosa cambia spostando, dall'anteprima del server
  // Il server sposta solo dentro gli ultimi 30 giorni (stringhe yyyy-MM-dd: si confrontano come testo)
  const minDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const maxDate = format(new Date(), 'yyyy-MM-dd');

  // Reinizializza la data quando cambia il workout
  useEffect(() => {
    if (workout) {
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
          setNewDate(formattedDate);
          setOriginalDate(formattedDate);
        } else {
          // Se la data non è valida, prendiamo la data corrente
          console.warn("Data non valida, uso la data corrente");
          setNewDate(format(new Date(), 'yyyy-MM-dd'));
          setError(t('history.date.invalid_original'));
        }
      } catch (e) {
        // Gestione errori più dettagliata
        console.error("Errore nel formato della data:", e);
        setNewDate(format(new Date(), 'yyyy-MM-dd'));
        setError(t('history.date.invalid_original'));
      }
    }
  }, [workout, t]);

  // Alla scelta di una data nuova il server dice cosa cambierebbe (streak, XP, achievement).
  // Ogni anteprima è una transazione con lock sul server: si chiede solo a scelta ferma e si annulla la precedente.
  useEffect(() => {
    setPreview(null);
    if (!open || !workout || !newDate || newDate === originalDate || newDate < minDate || newDate > maxDate) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${API_BASE_URL}api/workout_history/update_date.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workout.id, new_date: newDate, preview: true }),
        credentials: 'include',
        signal: controller.signal
      })
        .then(response => (response.ok ? response.json() : null))
        .then(data => { if (!controller.signal.aborted && data?.success) setPreview(data); })
        .catch(() => {});
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, workout, newDate, originalDate, minDate, maxDate]);

  const handleDateChange = (e) => {
    setNewDate(e.target.value);
    setError(''); // Puliamo eventuali errori quando l'utente modifica la data
  };

  const handleSubmit = async () => {
    if (!newDate) {
      setError(t('history.date.required'));
      return;
    }

    setLoading(true);
    setError('');

    try {
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(t(ERROR_KEYS[data.code] ?? 'history.date.error'));
      }

      // Chiamiamo il callback per informare il parent del successo
      // Utilizziamo la data restituita dal server che è in formato ISO completo
      onUpdateSuccess(workout.id, data.new_date || newDate);
      onClose();
    } catch (error) {
      console.error("Errore nell'aggiornamento della data:", error);
      setError(error.message || t('history.date.error'));
    } finally {
      setLoading(false);
    }
  };

  // Se non c'è un workout selezionato, non mostriamo il dialog
  if (!workout) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('history.date.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body1">
            {t('history.date.current')} {
              (() => {
                try {
                  // Mostra la data in formato leggibile italiano
                  const dateObj = new Date(workout.date);
                  if (isValid(dateObj)) {
                    return dateObj.toLocaleDateString(intlLocale(), {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                  } else {
                    return workout.date || t('history.date.unavailable');
                  }
                } catch {
                  return workout.date || t('history.date.unavailable');
                }
              })()
            }
          </Typography>
          <TextField
            label={t('history.date.new')}
            type="date"
            value={newDate}
            onChange={handleDateChange}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{ min: minDate, max: maxDate }}
          />
          {preview?.xp_delta > 0 && (
            <Typography variant="body2">{t('history.date.gain_xp', { xp: preview.xp_delta })}</Typography>
          )}
          {preview?.xp_delta < 0 && (
            <Typography variant="body2">{t('history.date.lose_xp', { xp: -preview.xp_delta })}</Typography>
          )}
          {preview && preview.streak_before !== preview.streak_after && (
            <Typography variant="body2">{t('history.streak_change', { from: preview.streak_before, to: preview.streak_after })}</Typography>
          )}
          {(preview?.achievements_unlocked ?? []).map(key => (
            <Typography key={key} variant="body2">{t('history.date.gain_achievement', { label: achievementLabel(key) })}</Typography>
          ))}
          {(preview?.achievements_removed ?? []).map(key => (
            <Typography key={key} variant="body2">{t('history.delete.lose_achievement', { label: achievementLabel(key) })}</Typography>
          ))}
          {workout.health_written && (
            <Typography variant="body2">{t('history.date.health_note')}</Typography>
          )}
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !newDate}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? t('history.date.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditWorkoutDateDialog; 
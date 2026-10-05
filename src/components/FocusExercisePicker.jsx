import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../config';
import { personalLabel } from '../api/exercises';

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
const ALL = '__all__';

// Catalogo caricato una volta per pagina: il picker si riapre spesso durante l'allenamento
let catalogCache = null;

// Scelta di un esercizio durante il Focus Mode.
// mode 'swap': cambia l'esercizio corrente (es. cavi occupati → manubri), parte
// dal suo gruppo muscolare. mode 'add': aggiunge un esercizio alla sessione, con
// serie/ripetizioni/recupero e, se allowPosition, "subito dopo" o "alla fine".
// onPick(catalogEx, { sets, reps, rest, position: 'next' | 'end' })
const FocusExercisePicker = ({ open, mode, currentExercise, allowPosition = true, onClose, onPick }) => {
  const [catalog, setCatalog] = useState(catalogCache || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(ALL);
  const [selected, setSelected] = useState(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [rest, setRest] = useState('90');
  const [position, setPosition] = useState('next');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(null);
    setError('');
    setGroup(mode === 'swap' && currentExercise?.muscle_group ? capitalize(currentExercise.muscle_group) : ALL);
    setSets(String(currentExercise?.sets || 3));
    setReps(String(currentExercise?.reps || '10'));
    setRest(String(currentExercise?.rest ?? 90));
    setPosition(allowPosition ? 'next' : 'end');

    if (catalogCache) return;
    setLoading(true);
    fetch(`${API_BASE_URL}api/exercise/read_all.php`, { method: 'GET', credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        catalogCache = Array.isArray(data?.records) ? data.records : [];
        setCatalog(catalogCache);
      })
      .catch(() => setError('Impossibile caricare gli esercizi. Riprova.'))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(
    () => [...new Set(catalog.map((ex) => capitalize(ex.muscle_group)).filter(Boolean))].sort(),
    [catalog]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((ex) => !(mode === 'swap' && String(ex.id) === String(currentExercise?.exercise_id)))
      // Con una ricerca si cerca in tutto il catalogo, senza filtro per gruppo
      .filter((ex) => q || group === ALL || capitalize(ex.muscle_group) === group)
      .filter((ex) => !q || ex.name?.toLowerCase().includes(q) || ex.name_en?.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [catalog, query, group, mode, currentExercise]);

  const handleSelect = (ex) => {
    if (mode === 'swap') {
      onPick(ex, {});
      return;
    }
    setSelected(ex);
  };

  const canAdd = selected && parseInt(sets, 10) > 0 && reps.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        {mode === 'swap' ? 'Cambia esercizio' : 'Aggiungi esercizio'}
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {mode === 'swap' && currentExercise && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Al posto di <strong>{currentExercise.exercise_name}</strong>, solo per questo allenamento.
          </Typography>
        )}

        {selected ? (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selected.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {[capitalize(selected.muscle_group), selected.equipment].filter(Boolean).join(' · ')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
              <TextField label="Serie" value={sets} onChange={(e) => setSets(e.target.value)}
                inputProps={{ inputMode: 'numeric' }} size="small" />
              <TextField label="Ripetizioni" value={reps} onChange={(e) => setReps(e.target.value)} size="small" />
              <TextField label="Recupero (s)" value={rest} onChange={(e) => setRest(e.target.value)}
                inputProps={{ inputMode: 'numeric' }} size="small" />
            </Box>
            {allowPosition && (
              <ToggleButtonGroup exclusive fullWidth size="small" value={position}
                onChange={(_, v) => v && setPosition(v)} sx={{ mt: 2 }}>
                <ToggleButton value="next">Subito dopo</ToggleButton>
                <ToggleButton value="end">Alla fine</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
        ) : (
          <>
            <TextField
              fullWidth size="small" placeholder="Cerca un esercizio" value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              sx={{ mb: 1.5 }}
            />
            {!query.trim() && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                {[ALL, ...groups].map((g) => (
                  <Chip key={g} label={g === ALL ? 'Tutti' : g} size="small"
                    color={group === g ? 'primary' : 'default'}
                    variant={group === g ? 'filled' : 'outlined'}
                    onClick={() => setGroup(g)} />
                ))}
              </Box>
            )}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
            ) : error ? (
              <Typography variant="body2" color="error">{error}</Typography>
            ) : (
              <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
                {results.map((ex) => (
                  <ListItemButton key={ex.id} onClick={() => handleSelect(ex)} sx={{ borderRadius: '8px' }}>
                    <ListItemText
                      primary={ex.name}
                      secondary={[capitalize(ex.muscle_group), ex.equipment, personalLabel(ex)].filter(Boolean).join(' · ')}
                    />
                  </ListItemButton>
                ))}
                {results.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
                    Nessun esercizio trovato. Gli esercizi nuovi si creano dalle Schede.
                  </Typography>
                )}
              </List>
            )}
          </>
        )}
      </DialogContent>
      {selected && (
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Indietro</Button>
          <Button variant="contained" disabled={!canAdd}
            onClick={() => onPick(selected, { sets, reps: reps.trim(), rest, position })}>
            Aggiungi
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default FocusExercisePicker;

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { adminExerciseAction, errorMessage, listAdminExercises } from '../../api/exercises';

const STATUS_LABELS = { pending: 'In attesa', approved: 'Approvati', rejected: 'Rifiutati' };

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// Nuovo esercizio ufficiale (exercise = null) o modifica di nome e gruppo muscolare
const ExerciseFormDialog = ({ open, exercise, muscleGroups, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(exercise?.name || '');
      setMuscleGroup(exercise?.muscle_group || '');
      setError('');
    }
  }, [open, exercise]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = exercise
      ? await adminExerciseAction('update', { id: exercise.id, name: name.trim(), muscle_group: muscleGroup })
      : await adminExerciseAction('create', { name: name.trim(), muscle_group: muscleGroup });
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    onSaved();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700 }}>
          {exercise ? 'Modifica esercizio' : 'Nuovo esercizio ufficiale'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 60 }}
            fullWidth
            required
            autoFocus
            margin="dense"
          />
          <TextField select label="Gruppo muscolare" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)}
            fullWidth required margin="dense">
            {muscleGroups.map((g) => <MenuItem key={g} value={g}>{capitalize(g)}</MenuItem>)}
          </TextField>
          {!exercise && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1.5 }}>
              Entra subito nel catalogo di tutti gli utenti.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>Annulla</Button>
          <Button type="submit" variant="contained" disabled={saving || !name.trim() || !muscleGroup}>Salva</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

// Coda di moderazione degli esercizi creati dagli utenti, più il catalogo approvato
const AdminExercises = () => {
  const [status, setStatus] = useState('pending');
  const [exercises, setExercises] = useState(null);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ open: false, exercise: null });

  const load = useCallback(async () => {
    setExercises(null);
    setError('');
    const res = await listAdminExercises(status);
    if (res.ok) {
      setExercises(res.data.exercises);
      setMuscleGroups(res.data.muscle_groups);
    } else {
      setExercises([]);
      setError(errorMessage(res, 'Impossibile caricare gli esercizi.'));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = async (action, exercise) => {
    if (action === 'delete' && !window.confirm(`Eliminare «${exercise.name}»?`)) return;
    setBusyId(exercise.id);
    setError('');
    const res = await adminExerciseAction(action, { id: exercise.id });
    setBusyId(null);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    setExercises((prev) => prev.filter((e) => e.id !== exercise.id));
  };

  const query = filter.trim().toLowerCase();
  const visible = (exercises || []).filter((e) => !query || e.name.toLowerCase().includes(query));

  return (
    <Card sx={{ p: '24px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 18 }}>Esercizi</Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setForm({ open: true, exercise: null })}>
          Nuovo esercizio
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => v && setStatus(v)}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <ToggleButton key={value} value={value}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField size="small" placeholder="Cerca" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {exercises === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : visible.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          {status === 'pending' ? 'Nessun esercizio in attesa.' : 'Nessun esercizio.'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {visible.map((e) => (
            <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{e.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                  <Chip label={capitalize(e.muscle_group)} size="small" />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {e.created_by_username ? `da ${e.created_by_username}` : 'catalogo'} · usato {e.uses} {e.uses === 1 ? 'volta' : 'volte'}
                  </Typography>
                </Box>
                {e.similar?.length > 0 && (
                  <Typography sx={{ fontSize: 13, color: 'warning.dark', mt: 0.75 }}>
                    Simile a: {e.similar.map((s) => `${s.name} (${s.muscle_group})`).join(' · ')}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {status !== 'approved' && (
                  <Button size="small" variant="contained" disabled={busyId === e.id} onClick={() => act('approve', e)}>Approva</Button>
                )}
                {status === 'pending' && (
                  <Button size="small" disabled={busyId === e.id} onClick={() => act('reject', e)}>Rifiuta</Button>
                )}
                <Button size="small" disabled={busyId === e.id} onClick={() => setForm({ open: true, exercise: e })}>Modifica</Button>
                <Button size="small" color="error" disabled={busyId === e.id || e.uses > 0}
                  title={e.uses > 0 ? 'È usato in schede o allenamenti' : undefined}
                  onClick={() => act('delete', e)}>Elimina</Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <ExerciseFormDialog
        open={form.open}
        exercise={form.exercise}
        muscleGroups={muscleGroups}
        onClose={() => setForm({ open: false, exercise: null })}
        onSaved={() => { setForm({ open: false, exercise: null }); load(); }}
      />
    </Card>
  );
};

export default AdminExercises;

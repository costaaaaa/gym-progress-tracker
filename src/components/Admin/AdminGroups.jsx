import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography,
} from '@mui/material';
import { errorMessage } from '../../api/exercises';
import { renameAdminGroup, searchAdminGroups } from '../../api/adminGroups';

const formatDate = (value) => new Date(value.replace(' ', 'T')).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

const lockLabel = (g) => {
  if (!g.name_locked) return null;
  return g.name_locked_until ? `Nome bloccato fino al ${formatDate(g.name_locked_until)}` : 'Nome bloccato per sempre';
};

const RenameDialog = ({ group, onClose, onDone }) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setNote('');
      setError('');
    }
  }, [group]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await renameAdminGroup(group.id, name.trim(), note.trim());
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    onDone(group.id, res.data.name);
  };

  return (
    <Dialog open={Boolean(group)} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      {group && (
        <Box component="form" onSubmit={submit}>
          <DialogTitle sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700 }}>Rinomina il gruppo</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
              Senza segnalazione, per esempio su richiesta del proprietario. Non cambia il blocco del nome.
            </Typography>
            <TextField
              label="Nuovo nome del gruppo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 60 }}
              fullWidth
              required
              autoFocus
              margin="dense"
            />
            <TextField
              label="Motivazione"
              helperText="Arriva per email al proprietario del gruppo."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
              required
              multiline
              minRows={2}
              margin="dense"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} disabled={saving}>Annulla</Button>
            <Button type="submit" variant="contained" disabled={saving || !name.trim() || !note.trim()}>Rinomina</Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
};

// Ricerca dei gruppi per id o nome e rinomina senza segnalazione
const AdminGroups = () => {
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError('');
    const res = await searchAdminGroups(query.trim());
    setSearching(false);
    if (res.ok) {
      setGroups(res.data.groups);
    } else {
      setGroups(null);
      setError(errorMessage(res, 'Impossibile cercare i gruppi.'));
    }
  };

  const done = (id, name) => {
    setRenaming(null);
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
  };

  return (
    <Card sx={{ p: '24px' }}>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 18, mb: 2 }}>Gruppi</Typography>

      <Box component="form" onSubmit={search} sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField size="small" placeholder="Id o nome del gruppo" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />
        <Button type="submit" variant="outlined" disabled={searching || !query.trim()}>Cerca</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {searching ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : groups && groups.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Nessun gruppo trovato.</Typography>
      ) : groups && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {groups.map((g) => (
            <Box key={g.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{g.name}</Typography>
                {g.name_locked && <Chip label={lockLabel(g)} size="small" />}
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                #{g.id} · di {g.owner} · {g.members_count} {g.members_count === 1 ? 'membro' : 'membri'} · creato il {formatDate(g.created_at)}
              </Typography>
              <Button size="small" sx={{ mt: 0.5 }} onClick={() => setRenaming(g)}>Rinomina</Button>
            </Box>
          ))}
        </Box>
      )}

      <RenameDialog group={renaming} onClose={() => setRenaming(null)} onDone={done} />
    </Card>
  );
};

export default AdminGroups;

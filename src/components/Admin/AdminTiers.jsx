import { useState } from 'react';
import { Alert, Box, Button, Card, CircularProgress, TextField, Typography } from '@mui/material';
import { errorMessage } from '../../api/exercises';
import { searchAdminTiers, setAdminTier } from '../../api/adminTiers';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

const MIN_QUERY = 2;
const LEVELS = [['free', 'Gratis'], ['plus', 'Plus'], ['pro', 'Pro']];
const label = (tier) => LEVELS.find(([value]) => value === tier)?.[1] ?? tier;

// "2026-12-31" → "31/12/2026", senza passare da Date (niente fusi)
const formatDay = (day) => day.split('-').reverse().join('/');

const isExpired = (u) => u.tier !== u.effective_tier;

// Livello salvato come lo vede l'admin: se è scaduto lo dice, perché l'utente di fatto è Gratis.
const summary = (u) => {
  if (isExpired(u)) return `${label(u.tier)}, scaduto il ${formatDay(u.last_day)} (di fatto ${label(u.effective_tier)})`;
  if (u.tier === 'free') return label(u.tier);
  return u.last_day ? `${label(u.tier)} fino al ${formatDay(u.last_day)} compreso` : `${label(u.tier)}, senza scadenza`;
};

// Una riga scaduta parte dallo stato in vigore (Gratis, senza data):
// Salva senza toccare nulla non ridà il livello
const TierRow = ({ user, onSaved }) => {
  const [tier, setTier] = useState(user.effective_tier);
  const [lastDay, setLastDay] = useState(isExpired(user) ? '' : user.last_day || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const chooseTier = (value) => {
    setTier(value);
    if (value === 'free') setLastDay('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const res = await setAdminTier(user.id, tier, tier === 'free' || !lastDay ? null : lastDay);
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    setSaved(true);
    setLastDay(res.data.user.last_day || '');
    onSaved(res.data.user);
  };

  return (
    <Box sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{user.username}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, wordBreak: 'break-word' }}>
        #{user.id} · {user.email} · {summary(user)}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
        <TextField
          select
          size="small"
          label="Livello"
          value={tier}
          onChange={(e) => chooseTier(e.target.value)}
          SelectProps={{ native: true }}
          sx={{ minWidth: 110 }}
        >
          {LEVELS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </TextField>
        <TextField
          size="small"
          type="date"
          label="Ultimo giorno valido"
          value={lastDay}
          onChange={(e) => setLastDay(e.target.value)}
          disabled={tier === 'free'}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="contained" size="small" onClick={save} disabled={saving}>Salva</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mt: 1 }}>Livello salvato.</Alert>}
    </Box>
  );
};

// Ricerca degli utenti per nome o email e assegnazione del livello (Gratis, Plus, Pro)
const AdminTiers = () => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const search = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError('');
    const res = await searchAdminTiers(query.trim());
    setSearching(false);
    if (res.ok) {
      setUsers(res.data.users);
    } else {
      setUsers(null);
      setError(errorMessage(res, 'Impossibile cercare gli utenti.'));
    }
  };

  const replaceUser = (user) => setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));

  return (
    <Card sx={{ p: '24px' }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 18, mb: 2 }}>Livello utente</Typography>

      <Box component="form" onSubmit={search} sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField size="small" placeholder="Nome o email" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />
        <Button type="submit" variant="outlined" disabled={searching || query.trim().length < MIN_QUERY}>Cerca</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {searching ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : users && users.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Nessun utente trovato.</Typography>
      ) : users && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {users.map((u) => <TierRow key={u.id} user={u} onSaved={replaceUser} />)}
        </Box>
      )}
    </Card>
  );
};

export default AdminTiers;

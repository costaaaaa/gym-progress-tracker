import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import AddIcon from '@mui/icons-material/Add';
import { usePageMeta } from '../hooks/usePageMeta';
import RequireLogin from '../components/Groups/RequireLogin';
import { createGroup, errorMessage, GROUP_TYPE_LABELS, listGroups, ROLE_LABELS } from '../api/groups';
import { track } from '../utils/analytics';

const CreateGroupDialog = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('friends');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await createGroup(name.trim(), type);
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    track('group_created', { type });
    setName('');
    onCreated(res.data.group);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700 }}>Nuovo gruppo</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Nome del gruppo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 60 }}
            fullWidth
            required
            autoFocus
            margin="dense"
          />
          <TextField select label="Tipo" value={type} onChange={(e) => setType(e.target.value)} fullWidth margin="dense">
            <MenuItem value="friends">Amici</MenuItem>
            <MenuItem value="gym">Palestra</MenuItem>
          </TextField>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1.5 }}>
            Dopo averlo creato ricevi un link di invito da condividere. La classifica premia la costanza:
            allenamenti fatti rispetto al proprio obiettivo settimanale.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>Annulla</Button>
          <Button type="submit" variant="contained" disabled={saving || !name.trim()}>Crea</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

const GroupsContent = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    const res = await listGroups();
    if (res.ok) setGroups(res.data.groups);
    else setError(errorMessage(res, 'Impossibile caricare i gruppi.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const joinWithCode = (e) => {
    e.preventDefault();
    const clean = code.replace(/\s+/g, '').toUpperCase();
    if (clean) navigate(`/entra?codice=${encodeURIComponent(clean)}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Typography component="h1" sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 28 }}>
          Gruppi
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Crea gruppo
        </Button>
      </Box>

      <Card sx={{ p: '22px', mb: 3 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Hai un codice invito?</Typography>
        <Box component="form" onSubmit={joinWithCode} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Es. K7M2QX9PHD"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ maxLength: 14, 'aria-label': 'Codice invito', style: { textTransform: 'uppercase', letterSpacing: '.08em' } }}
            sx={{ flex: '1 1 200px' }}
          />
          <Button type="submit" variant="outlined" disabled={!code.trim()}>Entra</Button>
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {groups === null && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      )}
      {groups?.length === 0 && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <GroupsOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Non sei ancora in nessun gruppo</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            Crea un gruppo con i tuoi amici o con la tua palestra e sfidatevi sulla costanza.
          </Typography>
        </Card>
      )}
      <Grid container spacing={2}>
        {groups?.map((g) => (
          <Grid item xs={12} md={6} key={g.id}>
            <Card>
              <CardActionArea component={RouterLink} to={`/gruppi/${g.id}`} sx={{ p: '22px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: (theme) => (theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GroupsOutlined sx={{ color: 'primary.main' }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      {GROUP_TYPE_LABELS[g.type]} · {g.members_count} {g.members_count === 1 ? 'membro' : 'membri'}
                    </Typography>
                  </Box>
                  {g.my_role !== 'member' && <Chip size="small" label={ROLE_LABELS[g.my_role]} />}
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(group) => navigate(`/gruppi/${group.id}`)}
      />
    </Container>
  );
};

const Groups = () => {
  usePageMeta('Gruppi', 'Allenati con amici e compagni di palestra: classifica settimanale di costanza, streak e livelli.');
  return <RequireLogin><GroupsContent /></RequireLogin>;
};

export default Groups;

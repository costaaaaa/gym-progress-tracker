import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Grid, IconButton, Snackbar, Switch, FormControlLabel, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import { usePageMeta } from '../hooks/usePageMeta';
import RequireLogin from '../components/Groups/RequireLogin';
import LeaderboardTable from '../components/Groups/LeaderboardTable';
import {
  errorMessage, GROUP_TYPE_LABELS, inviteLink, leaveGroup, manageGroup, readGroup, ROLE_LABELS,
} from '../api/groups';
import { track } from '../utils/analytics';

const BOARDS = [
  { key: 'week', label: 'Settimana', hint: 'Allenamenti fatti rispetto al proprio obiettivo settimanale.' },
  { key: 'streak', label: 'Streak', hint: 'Settimane consecutive con l\'obiettivo raggiunto.' },
  { key: 'level', label: 'Livello', hint: 'Livello ed esperienza accumulata.' },
];

const formatDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

// Conferma per le azioni che non si annullano (uscire, eliminare, rimuovere un membro)
const ConfirmDialog = ({ confirm, onClose }) => (
  <Dialog open={Boolean(confirm)} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{confirm?.title}</DialogTitle>
    <DialogContent><DialogContentText>{confirm?.text}</DialogContentText></DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose}>Annulla</Button>
      <Button color="error" variant="contained" onClick={() => { confirm.action(); onClose(); }}>{confirm?.cta}</Button>
    </DialogActions>
  </Dialog>
);

const InvitePanel = ({ group, onChange, notify }) => {
  const link = inviteLink(group.invite_code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify('Link di invito copiato');
    } catch {
      notify('Copia non riuscita: seleziona il link a mano');
    }
  };
  const regenerate = async () => {
    const res = await manageGroup(group.id, 'regenerate_code');
    if (res.ok) {
      onChange({ invite_code: res.data.invite_code });
      notify('Nuovo codice creato: il vecchio link non funziona più');
    } else notify(errorMessage(res));
  };
  const toggle = async (enabled) => {
    const res = await manageGroup(group.id, 'toggle_invites', { enabled });
    if (res.ok) onChange({ invite_enabled: res.data.invite_enabled });
    else notify(errorMessage(res));
  };

  return (
    <Card sx={{ p: '22px' }}>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 1.5 }}>Invita</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TextField value={link} size="small" fullWidth inputProps={{ readOnly: true, 'aria-label': 'Link di invito' }} disabled={!group.invite_enabled} />
        <Tooltip title="Copia link">
          <span>
            <IconButton onClick={copy} disabled={!group.invite_enabled} aria-label="Copia link di invito"><ContentCopyIcon /></IconButton>
          </span>
        </Tooltip>
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
        Codice: <Box component="strong" sx={{ letterSpacing: '.08em' }}>{group.invite_code}</Box> · {group.members_count}/{group.max_members} membri
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <FormControlLabel
          control={<Switch checked={group.invite_enabled} onChange={(e) => toggle(e.target.checked)} />}
          label="Inviti aperti"
        />
        <Button size="small" onClick={regenerate}>Nuovo codice</Button>
      </Box>
    </Card>
  );
};

const GroupDetailContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState('week');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [renaming, setRenaming] = useState(null);

  const load = useCallback(async () => {
    const res = await readGroup(id, board);
    if (res.ok) {
      setData(res.data);
      setError('');
    } else {
      setError(errorMessage(res, 'Impossibile caricare il gruppo.'));
    }
  }, [id, board]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { track('leaderboard_viewed', { board }); }, [board]);

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button component={RouterLink} to="/gruppi" startIcon={<ArrowBackIcon />}>I tuoi gruppi</Button>
      </Container>
    );
  }
  if (!data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  const { group, week, members } = data;
  const canManage = group.my_role === 'owner' || group.my_role === 'admin';
  const isOwner = group.my_role === 'owner';
  const patchGroup = (patch) => setData((d) => ({ ...d, group: { ...d.group, ...patch } }));

  const leave = async () => {
    const res = await leaveGroup(group.id);
    if (res.ok) {
      track('group_left');
      navigate('/gruppi');
    } else setToast(errorMessage(res));
  };
  const remove = async () => {
    const res = await manageGroup(group.id, 'delete');
    if (res.ok) navigate('/gruppi');
    else setToast(errorMessage(res));
  };
  const removeMember = async (member) => {
    const res = await manageGroup(group.id, 'remove_member', { ref: member.ref });
    if (res.ok) {
      setToast(`${member.username} è stato rimosso`);
      load();
    } else setToast(errorMessage(res));
  };
  const saveName = async (e) => {
    e.preventDefault();
    const res = await manageGroup(group.id, 'rename', { name: renaming.trim() });
    if (res.ok) {
      patchGroup({ name: res.data.name });
      setRenaming(null);
    } else setToast(errorMessage(res));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Button component={RouterLink} to="/gruppi" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>I tuoi gruppi</Button>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Typography component="h1" sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 28 }}>{group.name}</Typography>
        <Chip size="small" label={GROUP_TYPE_LABELS[group.type]} />
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          {group.members_count} {group.members_count === 1 ? 'membro' : 'membri'}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ p: '22px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>Classifica</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Settimana {formatDay(week.from)} – {formatDay(week.to)}
              </Typography>
            </Box>
            <Tabs value={board} onChange={(e, v) => setBoard(v)} sx={{ mb: 1 }} variant="fullWidth">
              {BOARDS.map((b) => <Tab key={b.key} value={b.key} label={b.label} />)}
            </Tabs>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>{BOARDS.find((b) => b.key === board).hint}</Typography>
            <LeaderboardTable rows={data.board} board={data.board_type} />
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {canManage && <InvitePanel group={group} onChange={patchGroup} notify={setToast} />}

            <Card sx={{ p: '22px' }}>
              <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 1 }}>Membri</Typography>
              {members.map((m) => (
                <Box key={m.username} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
                  <Typography sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: m.is_me ? 700 : 400 }}>
                    {m.username}{m.is_me ? ' (tu)' : ''}
                  </Typography>
                  {m.role !== 'member' && <Chip size="small" label={ROLE_LABELS[m.role]} />}
                  {canManage && m.ref && !m.is_me && m.role !== 'owner' && (isOwner || m.role === 'member') && (
                    <Tooltip title="Rimuovi dal gruppo">
                      <IconButton
                        size="small"
                        aria-label={`Rimuovi ${m.username}`}
                        onClick={() => setConfirm({
                          title: `Rimuovere ${m.username}?`,
                          text: 'Non vedrà più il gruppo. Potrà rientrare solo con un nuovo invito.',
                          cta: 'Rimuovi',
                          action: () => removeMember(m),
                        })}
                      >
                        <PersonRemoveOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Card>

            <Card sx={{ p: '22px' }}>
              <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 1.5 }}>Impostazioni</Typography>
              {canManage && (renaming === null ? (
                <Button size="small" onClick={() => setRenaming(group.name)} sx={{ mb: 1 }}>Rinomina il gruppo</Button>
              ) : (
                <Box component="form" onSubmit={saveName} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <TextField size="small" value={renaming} onChange={(e) => setRenaming(e.target.value)} inputProps={{ maxLength: 60, 'aria-label': 'Nome del gruppo' }} fullWidth autoFocus />
                  <Button type="submit" size="small" variant="contained" disabled={!renaming.trim()}>Salva</Button>
                </Box>
              ))}
              {isOwner ? (
                <Button
                  color="error"
                  size="small"
                  onClick={() => setConfirm({
                    title: 'Eliminare il gruppo?',
                    text: 'Il gruppo e la classifica spariscono per tutti i membri. Gli allenamenti di ognuno restano nei rispettivi account.',
                    cta: 'Elimina',
                    action: remove,
                  })}
                >
                  Elimina il gruppo
                </Button>
              ) : (
                <Button
                  color="error"
                  size="small"
                  onClick={() => setConfirm({
                    title: 'Uscire dal gruppo?',
                    text: 'I tuoi dati spariscono subito dalla classifica. Per rientrare servirà un nuovo invito.',
                    cta: 'Esci',
                    action: leave,
                  })}
                >
                  Esci dal gruppo
                </Button>
              )}
            </Card>
          </Box>
        </Grid>
      </Grid>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Container>
  );
};

const GroupDetail = () => {
  usePageMeta('Gruppo', 'Classifica settimanale del gruppo: costanza, streak e livelli.');
  return <RequireLogin><GroupDetailContent /></RequireLogin>;
};

export default GroupDetail;

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { errorMessage } from '../../api/exercises';
import { adminReportAction, listAdminReports } from '../../api/reports';

const STATUS_LABELS = { open: 'Aperte', resolved: 'Accolte', dismissed: 'Respinte' };
const TARGET_LABELS = { group_name: 'Nome del gruppo', member: 'Username' };

// Azioni sulle segnalazioni aperte. La nota è sempre obbligatoria: è la motivazione (DSA art. 17)
// che arriva per email a chi ha segnalato e, nelle rinomine, a chi subisce la modifica.
const ACTIONS = {
  resolve: { title: 'Accogli la segnalazione', cta: 'Accogli' },
  dismiss: { title: 'Respingi la segnalazione', cta: 'Respingi' },
  rename_group: { title: 'Rinomina il gruppo', cta: 'Rinomina', field: 'name', fieldLabel: 'Nuovo nome del gruppo', max: 60 },
  rename_user: { title: "Rinomina l'utente", cta: 'Rinomina', field: 'username', fieldLabel: 'Nuovo username', max: 50 },
};

const formatDate = (value) => (value ? new Date(value.replace(' ', 'T')).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '');

const ReportActionDialog = ({ pending, onClose, onDone }) => {
  const [note, setNote] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const action = pending ? ACTIONS[pending.action] : null;

  useEffect(() => {
    if (pending) {
      setNote('');
      setValue('');
      setError('');
    }
  }, [pending]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const extra = { note: note.trim() };
    if (action.field) extra[action.field] = value.trim();
    const res = await adminReportAction(pending.action, pending.report.id, extra);
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    onDone(pending.report.id);
  };

  return (
    <Dialog open={Boolean(pending)} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      {action && (
        <Box component="form" onSubmit={submit}>
          <DialogTitle sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700 }}>{action.title}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {action.field && (
              <TextField
                label={action.fieldLabel}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputProps={{ maxLength: action.max }}
                fullWidth
                required
                autoFocus
                margin="dense"
              />
            )}
            <TextField
              label="Motivazione"
              helperText="Arriva per email a chi ha segnalato e, nelle rinomine, a chi subisce la modifica."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              fullWidth
              required
              multiline
              minRows={2}
              autoFocus={!action.field}
              margin="dense"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} disabled={saving}>Annulla</Button>
            <Button type="submit" variant="contained" disabled={saving || !note.trim() || (action.field && !value.trim())}>
              {action.cta}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
};

// Segnalazioni dei contenuti nei gruppi (nome del gruppo o username di un membro)
const AdminReports = () => {
  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    setReports(null);
    setError('');
    const res = await listAdminReports(status);
    if (res.ok) {
      setReports(res.data.reports);
    } else {
      setReports([]);
      setError(errorMessage(res, 'Impossibile caricare le segnalazioni.'));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const done = (id) => {
    setPending(null);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <Card sx={{ p: '24px' }}>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 18, mb: 2 }}>Segnalazioni</Typography>

      <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => v && setStatus(v)} sx={{ mb: 2 }}>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <ToggleButton key={value} value={value}>{label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {reports === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : reports.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          {status === 'open' ? 'Nessuna segnalazione aperta.' : 'Nessuna segnalazione.'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {reports.map((r) => (
            <Box key={r.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip label={TARGET_LABELS[r.target] || r.target} size="small" />
                <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{r.target_label}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                #{r.id} · {r.group_name ? `gruppo «${r.group_name}»` : 'gruppo eliminato'} · da {r.reporter || 'account eliminato'} · {formatDate(r.created_at)}
              </Typography>
              <Typography sx={{ fontSize: 14, mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.reason}</Typography>
              {r.decision_note && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, wordBreak: 'break-word' }}>
                  Motivazione ({formatDate(r.decided_at)}): {r.decision_note}
                </Typography>
              )}
              {status === 'open' && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  <Button size="small" variant="contained" onClick={() => setPending({ action: 'resolve', report: r })}>Accogli</Button>
                  <Button size="small" onClick={() => setPending({ action: 'dismiss', report: r })}>Respingi</Button>
                  {r.target === 'group_name' && r.group_name && (
                    <Button size="small" onClick={() => setPending({ action: 'rename_group', report: r })}>Rinomina gruppo</Button>
                  )}
                  {r.target === 'member' && (
                    <Button size="small" onClick={() => setPending({ action: 'rename_user', report: r })}>Rinomina utente</Button>
                  )}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      <ReportActionDialog pending={pending} onClose={() => setPending(null)} onDone={done} />
    </Card>
  );
};

export default AdminReports;

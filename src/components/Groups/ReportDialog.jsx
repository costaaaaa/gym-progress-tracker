import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, TextField, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { errorMessage, reportGroup } from '../../api/groups';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Segnalazione del nome del gruppo o dello username di un membro (DSA art. 16).
// Stesse regole del server (groups/report.php): motivo di 10-1000 caratteri e buona fede.
const REASON_MIN = 10;
const REASON_MAX = 1000;

const ReportDialog = ({ open, group, members, onClose, onSent }) => {
  const { t } = useTranslation();
  const [target, setTarget] = useState('group_name');
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTarget('group_name');
      setUsername('');
      setReason('');
      setGoodFaith(false);
      setError('');
    }
  }, [open]);

  const others = members.filter((m) => !m.is_me);
  const ready = reason.trim().length >= REASON_MIN && goodFaith && (target === 'group_name' || username !== '');

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    const payload = target === 'member' ? { target, username, reason: reason.trim() } : { target, reason: reason.trim() };
    const res = await reportGroup(group.id, payload);
    setSending(false);
    if (!res.ok) {
      setError(errorMessage(res));
      return;
    }
    onSent();
  };

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700 }}>{t('groups.detail.report.title')}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <ToggleButtonGroup exclusive fullWidth size="small" value={target} onChange={(_, v) => v && setTarget(v)} sx={{ mb: 2 }}>
            <ToggleButton value="group_name">{t('groups.detail.report.target_group')}</ToggleButton>
            <ToggleButton value="member" disabled={others.length === 0}>{t('groups.detail.report.target_member')}</ToggleButton>
          </ToggleButtonGroup>
          {target === 'member' && (
            <TextField select fullWidth margin="dense" label={t('groups.detail.report.member')} value={username}
              onChange={(e) => setUsername(e.target.value)}>
              {others.map((m) => <MenuItem key={m.username} value={m.username}>{m.username}</MenuItem>)}
            </TextField>
          )}
          <TextField
            fullWidth multiline minRows={3} margin="dense"
            label={t('groups.detail.report.reason')}
            helperText={t('groups.detail.report.reason_help', { min: REASON_MIN })}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ maxLength: REASON_MAX }}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />}
            label={t('groups.detail.report.good_faith')}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={sending}>{t('groups.detail.report.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={sending || !ready}>{t('groups.detail.report.submit')}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ReportDialog;

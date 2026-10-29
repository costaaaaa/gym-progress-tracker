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
import ReportDialog from '../components/Groups/ReportDialog';
import {
  errorMessage, groupTypeLabel, inviteLink, leaveGroup, manageGroup, readGroup, roleLabel,
} from '../api/groups';
import { track } from '../utils/analytics';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '../i18n/format';
import { NEUTRAL_TEXT, DANGER_TEXT } from '../utils/buttonStyles';
import { INK_TABS } from '../utils/inkTabs';

const BOARDS = ['week', 'streak', 'level'];

const formatDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
// Il server manda un ISO con offset ("2026-10-30T18:05:00+01:00"): è un istante, si mostra nel fuso del browser
const formatLockDate = (value) => new Date(value).toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' });

// Conferma per le azioni che non si annullano (uscire, eliminare, rimuovere un membro)
const ConfirmDialog = ({ confirm, onClose }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={Boolean(confirm)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{confirm?.title}</DialogTitle>
      <DialogContent><DialogContentText>{confirm?.text}</DialogContentText></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ fontSize: 16 }}>{t('common.cancel')}</Button>
        <Button color="error" variant="contained" onClick={() => { confirm.action(); onClose(); }} sx={{ fontSize: 16 }}>{confirm?.cta}</Button>
      </DialogActions>
    </Dialog>
  );
};

const InvitePanel = ({ group, onChange, notify }) => {
  const { t } = useTranslation();
  const link = inviteLink(group.invite_code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify(t('groups.detail.invite.copied'));
    } catch {
      notify(t('groups.detail.invite.copy_failed'));
    }
  };
  const regenerate = async () => {
    const res = await manageGroup(group.id, 'regenerate_code');
    if (res.ok) {
      onChange({ invite_code: res.data.invite_code });
      notify(t('groups.detail.invite.new_code_done'));
    } else notify(errorMessage(res));
  };
  const toggle = async (enabled) => {
    const res = await manageGroup(group.id, 'toggle_invites', { enabled });
    if (res.ok) onChange({ invite_enabled: res.data.invite_enabled });
    else notify(errorMessage(res));
  };

  return (
    <Card sx={{ p: '22px' }}>
      <Typography variant="cardTitle" sx={{ mb: 1.5 }}>{t('groups.detail.invite.title')}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TextField value={link} size="small" fullWidth inputProps={{ readOnly: true, 'aria-label': t('groups.detail.invite.link_label') }} disabled={!group.invite_enabled} />
        <Tooltip title={t('groups.detail.invite.copy_tooltip')}>
          <span>
            <IconButton onClick={copy} disabled={!group.invite_enabled} aria-label={t('groups.detail.invite.copy_label')}><ContentCopyIcon /></IconButton>
          </span>
        </Tooltip>
      </Box>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 1 }}>
        <Trans
          i18nKey="groups.detail.invite.code_line"
          values={{ code: group.invite_code, count: group.members_count, max: group.max_members }}
          components={{ code: <Box component="strong" sx={{ letterSpacing: '.08em' }} /> }}
        />
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <FormControlLabel
          control={<Switch checked={group.invite_enabled} onChange={(e) => toggle(e.target.checked)} />}
          label={t('groups.detail.invite.open')}
        />
        <Button onClick={regenerate} sx={NEUTRAL_TEXT}>{t('groups.detail.invite.new_code')}</Button>
      </Box>
    </Card>
  );
};

const GroupDetailContent = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState('week');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    const res = await readGroup(id, board);
    if (res.ok) {
      setData(res.data);
      setError('');
    } else {
      setError(errorMessage(res, t('groups.detail.load_error')));
    }
  }, [id, board, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { track('leaderboard_viewed', { board }); }, [board]);

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button component={RouterLink} to="/gruppi" startIcon={<ArrowBackIcon />} sx={{ fontSize: 16 }}>{t('groups.join.your_groups')}</Button>
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
      setToast(t('groups.detail.remove.done', { name: member.username }));
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
      <Button component={RouterLink} to="/gruppi" startIcon={<ArrowBackIcon />} sx={{ ...NEUTRAL_TEXT, mb: 1 }}>{t('groups.join.your_groups')}</Button>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="pageTitle">{group.name}</Typography>
        <Chip size="small" label={groupTypeLabel(group.type)} />
        <Typography sx={{ color: 'text.secondary', fontSize: 16 }}>
          {t('groups_card.members', { count: Number(group.members_count) })}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ p: '22px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Typography variant="cardTitle">{t('groups.detail.leaderboard')}</Typography>
              <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
                {t('groups.detail.week_range', { from: formatDay(week.from), to: formatDay(week.to) })}
              </Typography>
            </Box>
            <Tabs value={board} onChange={(e, v) => setBoard(v)} {...INK_TABS} sx={[INK_TABS.sx, { mb: 1 }]} variant="fullWidth">
              {BOARDS.map((b) => <Tab key={b} value={b} label={t(`groups.detail.board.${b}`)} />)}
            </Tabs>
            <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 1 }}>{t(`groups.detail.board.${board}_hint`)}</Typography>
            <LeaderboardTable rows={data.board} board={data.board_type} />
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {canManage && <InvitePanel group={group} onChange={patchGroup} notify={setToast} />}

            <Card sx={{ p: '22px' }}>
              <Typography variant="cardTitle" sx={{ mb: 1 }}>{t('groups.detail.members')}</Typography>
              {members.map((m) => (
                <Box key={m.username} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
                  <Typography sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: m.is_me ? 700 : 400 }}>
                    {m.username}{m.is_me ? t('groups.detail.me_suffix') : ''}
                  </Typography>
                  {m.role !== 'member' && <Chip size="small" label={roleLabel(m.role)} />}
                  {canManage && m.ref && !m.is_me && m.role !== 'owner' && (isOwner || m.role === 'member') && (
                    <Tooltip title={t('groups.detail.remove.tooltip')}>
                      <IconButton
                        size="small"
                        aria-label={t('groups.detail.remove.label', { name: m.username })}
                        onClick={() => setConfirm({
                          title: t('groups.detail.remove.title', { name: m.username }),
                          text: t('groups.detail.remove.text'),
                          cta: t('groups.detail.remove.cta'),
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
              <Typography variant="cardTitle" sx={{ mb: 1.5 }}>{t('groups.detail.settings')}</Typography>
              {canManage && group.name_locked && (
                <>
                  <Button disabled sx={{ fontSize: 16, mb: 0.5 }}>{t('groups.detail.rename')}</Button>
                  <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 1.5 }}>
                    {group.name_locked_until
                      ? t('groups.detail.name_locked_until', { date: formatLockDate(group.name_locked_until) })
                      : t('groups.detail.name_locked')}
                  </Typography>
                </>
              )}
              {canManage && !group.name_locked && (renaming === null ? (
                <Button onClick={() => setRenaming(group.name)} sx={{ ...NEUTRAL_TEXT, mb: 1 }}>{t('groups.detail.rename')}</Button>
              ) : (
                <Box component="form" onSubmit={saveName} sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <TextField size="small" value={renaming} onChange={(e) => setRenaming(e.target.value)} inputProps={{ maxLength: 60, 'aria-label': t('groups.new.name') }} fullWidth autoFocus />
                  <Button type="submit" variant="contained" disabled={!renaming.trim()} sx={{ fontSize: 16 }}>{t('groups.detail.save')}</Button>
                </Box>
              ))}
              {isOwner ? (
                <Button
                  sx={DANGER_TEXT}
                  onClick={() => setConfirm({
                    title: t('groups.detail.delete.title'),
                    text: t('groups.detail.delete.text'),
                    cta: t('groups.detail.delete.cta'),
                    action: remove,
                  })}
                >
                  {t('groups.detail.delete.button')}
                </Button>
              ) : (
                <Button
                  sx={NEUTRAL_TEXT}
                  onClick={() => setConfirm({
                    title: t('groups.detail.leave.title'),
                    text: t('groups.detail.leave.text'),
                    cta: t('groups.detail.leave.cta'),
                    action: leave,
                  })}
                >
                  {t('groups.detail.leave.button')}
                </Button>
              )}
              <Button
                onClick={() => setReporting(true)}
                sx={{ ...NEUTRAL_TEXT, display: 'block', mt: 1 }}
              >
                {t('groups.detail.report.button')}
              </Button>
            </Card>
          </Box>
        </Grid>
      </Grid>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      <ReportDialog
        open={reporting}
        group={group}
        members={members}
        onClose={() => setReporting(false)}
        onSent={() => {
          setReporting(false);
          setToast(t('groups.detail.report.sent'));
        }}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Container>
  );
};

const GroupDetail = () => {
  const { t } = useTranslation();
  usePageMeta(t('groups.detail.meta_title'), t('groups.detail.meta_description'));
  return <RequireLogin><GroupDetailContent /></RequireLogin>;
};

export default GroupDetail;

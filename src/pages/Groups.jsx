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
import { createGroup, errorMessage, groupTypeLabel, listGroups, roleLabel } from '../api/groups';
import { track } from '../utils/analytics';
import { useTranslation } from 'react-i18next';
import { TITLE_FONT_FAMILY } from '../utils/fonts';
import { NEUTRAL_OUTLINED } from '../utils/neutralButton';

const CreateGroupDialog = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
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
        <DialogTitle sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700 }}>{t('groups.new.title')}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label={t('groups.new.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 60 }}
            fullWidth
            required
            autoFocus
            margin="dense"
          />
          <TextField select label={t('groups.new.type')} value={type} onChange={(e) => setType(e.target.value)} fullWidth margin="dense">
            <MenuItem value="friends">{t('groups.type.friends')}</MenuItem>
            <MenuItem value="gym">{t('groups.type.gym')}</MenuItem>
          </TextField>
          <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 1.5 }}>
            {t('groups.new.help')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving} sx={{ fontSize: 16 }}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={saving || !name.trim()} sx={{ fontSize: 16 }}>{t('common.create')}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

const GroupsContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    const res = await listGroups();
    if (res.ok) setGroups(res.data.groups);
    else setError(errorMessage(res, t('groups.load_error')));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const joinWithCode = (e) => {
    e.preventDefault();
    const clean = code.replace(/\s+/g, '').toUpperCase();
    if (clean) navigate(`/entra?codice=${encodeURIComponent(clean)}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="pageTitle">
          {t('groups.title')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ fontSize: 16 }}>
          {t('groups.create')}
        </Button>
      </Box>

      <Card sx={{ p: '22px', mb: 3 }}>
        <Typography variant="cardTitle" sx={{ mb: 1.5 }}>{t('groups.code.title')}</Typography>
        <Box component="form" onSubmit={joinWithCode} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder={t('groups.code.placeholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ maxLength: 14, 'aria-label': t('groups.code.label'), style: { textTransform: 'uppercase', letterSpacing: '.08em' } }}
            sx={{ flex: '1 1 200px' }}
          />
          <Button type="submit" variant="outlined" disabled={!code.trim()} sx={NEUTRAL_OUTLINED}>{t('groups.code.join')}</Button>
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {groups === null && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      )}
      {groups?.length === 0 && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <GroupsOutlined sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="cardTitle" sx={{ mb: 1 }}>{t('groups.empty.title')}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 16 }}>
            {t('groups.empty.text')}
          </Typography>
        </Card>
      )}
      <Grid container spacing={2}>
        {groups?.map((g) => (
          <Grid item xs={12} md={6} key={g.id}>
            <Card>
              <CardActionArea component={RouterLink} to={`/gruppi/${g.id}`} sx={{ p: '22px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="cardTitle" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </Typography>
                    <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
                      {groupTypeLabel(g.type)} · {t('groups_card.members', { count: Number(g.members_count) })}
                    </Typography>
                  </Box>
                  {g.my_role !== 'member' && <Chip size="small" label={roleLabel(g.my_role)} />}
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
  const { t } = useTranslation();
  usePageMeta(t('groups.meta.title'), t('groups.meta.description'));
  return <RequireLogin><GroupsContent /></RequireLogin>;
};

export default Groups;

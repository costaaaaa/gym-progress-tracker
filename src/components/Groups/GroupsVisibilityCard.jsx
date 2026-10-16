import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, Link, Typography } from '@mui/material';
import { errorMessage, leaveGroup, listGroups, roleLabel } from '../../api/groups';
import { track } from '../../utils/analytics';
import { useTranslation } from 'react-i18next';

// Impostazioni account: in quali gruppi sei, cosa vedono gli altri, uscita con un clic
const GroupsVisibilityCard = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listGroups().then((res) => setGroups(res.ok ? res.data.groups : []));
  }, []);

  const leave = async (group) => {
    if (!window.confirm(t('groups.leave_confirm', { name: group.name }))) return;
    const res = await leaveGroup(group.id);
    if (res.ok) {
      track('group_left');
      setGroups((list) => list.filter((g) => g.id !== group.id));
    } else {
      setError(errorMessage(res));
    }
  };

  return (
    <Card sx={{ p: '24px' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t('groups.visibility.title')}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, mb: 1.5, maxWidth: 560 }}>
        {t('groups.visibility.text')}
      </Typography>
      {error && <Typography sx={{ fontSize: 13, color: 'error.main', mb: 1 }}>{error}</Typography>}
      {groups?.length === 0 && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {t('groups.visibility.none')} <Link component={RouterLink} to="/gruppi">{t('groups.visibility.go')}</Link>
        </Typography>
      )}
      {groups?.map((g) => (
        <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ minWidth: 0 }}>
            <Link component={RouterLink} to={`/gruppi/${g.id}`} sx={{ fontSize: 14, fontWeight: 600 }}>{g.name}</Link>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{roleLabel(g.my_role)}</Typography>
          </Box>
          {g.my_role === 'owner' ? (
            <Button size="small" component={RouterLink} to={`/gruppi/${g.id}`}>{t('groups.visibility.manage')}</Button>
          ) : (
            <Button size="small" color="error" onClick={() => leave(g)}>{t('groups.visibility.leave')}</Button>
          )}
        </Box>
      ))}
    </Card>
  );
};

export default GroupsVisibilityCard;

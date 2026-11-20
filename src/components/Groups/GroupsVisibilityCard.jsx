import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Button, Card, Link, Typography } from '@mui/material';
import { errorMessage, leaveGroup, listGroups, roleLabel } from '../../api/groups';
import { track } from '../../utils/analytics';
import { useTranslation } from 'react-i18next';
import { NEUTRAL_TEXT } from '../../utils/buttonStyles';
import { useModule } from '../../hooks/useModule';
import GroupVisibilityOptions from './GroupVisibilityOptions';

const FOCUS_RING = (theme) => ({
  '&:focus-visible': { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: '2px' },
});

// Impostazioni account: cosa mostro agli altri membri (sempre visibile: è un comando di privacy), in quali gruppi sei,
// uscita con un clic. `notify(messaggio, gravità)` annuncia l'esito dei cambi (la notifica della pagina).
const GroupsVisibilityCard = ({ notify }) => {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const groupsActive = useModule('groups');
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listGroups().then((res) => setGroups(res.ok ? res.data.groups : []));
  }, []);

  // Chi arriva da un collegamento a «Cosa mostro» trova il fuoco sul blocco
  useEffect(() => {
    if (hash !== '#groups-shown') return;
    const block = document.getElementById('groups-shown');
    block?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    block?.focus();
  }, [hash]);

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
    <Card id="groups-visibility" tabIndex={-1} sx={(theme) => ({ p: '24px', ...FOCUS_RING(theme) })}>
      <Typography variant="cardTitle">{t('groups.visibility.title')}</Typography>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5, mb: 1.5, maxWidth: 560 }}>
        {t('groups.visibility.text')}
      </Typography>
      <Box id="groups-shown" role="group" aria-labelledby="groups-shown-title" tabIndex={-1} sx={(theme) => ({ mb: 1.5, ...FOCUS_RING(theme) })}>
        <Typography id="groups-shown-title" component="h3" sx={{ fontSize: 16, fontWeight: 700 }}>{t('groups.shown.title')}</Typography>
        <GroupVisibilityOptions notify={notify} />
      </Box>
      {error && <Typography sx={{ fontSize: 16, color: 'error.main', mb: 1 }}>{error}</Typography>}
      <Box id="groups-list" role="group" aria-label={t('groups.visibility.list')} tabIndex={-1} sx={FOCUS_RING}>
      {groups?.length === 0 && (
        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
          {t('groups.visibility.none')}
          {/* A Gruppi non attivo il collegamento porterebbe alla pagina «non attivo» */}
          {groupsActive && <>{' '}<Link component={RouterLink} to="/gruppi">{t('groups.visibility.go')}</Link></>}
        </Typography>
      )}
      {groups?.map((g) => (
        <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ minWidth: 0 }}>
            <Link component={RouterLink} to={`/gruppi/${g.id}`} underline="none" sx={{ fontSize: 16, fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>{g.name}</Link>
            <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{roleLabel(g.my_role)}</Typography>
          </Box>
          {g.my_role === 'owner' ? (
            <Button component={RouterLink} to={`/gruppi/${g.id}`} sx={NEUTRAL_TEXT}>{t('groups.visibility.manage')}</Button>
          ) : (
            <Button onClick={() => leave(g)} sx={NEUTRAL_TEXT}>{t('groups.visibility.leave')}</Button>
          )}
        </Box>
      ))}
      </Box>
    </Card>
  );
};

export default GroupsVisibilityCard;

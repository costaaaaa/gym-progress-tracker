import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardActionArea, Typography } from '@mui/material';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import { listGroups } from '../../api/groups';
import { useTranslation } from 'react-i18next';

// Card «I tuoi gruppi» della home: ingresso ai gruppi anche da mobile web, dove la
// barra in basso è già piena.
const GroupsHomeCard = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listGroups().then((res) => {
      if (!cancelled) setGroups(res.ok ? res.data.groups : []);
    });
    return () => { cancelled = true; };
  }, []);

  if (groups === null) return null;

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={RouterLink} to="/gruppi" sx={{ height: '100%', p: '26px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: (theme) => (theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)'), display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
            <GroupsOutlined sx={{ color: 'primary.main', fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17 }}>{t('groups_card.title')}</Typography>
        </Box>
        {groups.length === 0 ? (
          <>
            <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
              {t('groups_card.empty')}
            </Typography>
            <Button component="span" variant="outlined" size="small">{t('groups_card.cta')}</Button>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {groups.slice(0, 3).map((g) => (
              <Box key={g.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }}>{t('groups_card.members', { count: Number(g.members_count) })}</Typography>
              </Box>
            ))}
            {groups.length > 3 && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('groups_card.more', { count: groups.length - 3 })}</Typography>
            )}
          </Box>
        )}
      </CardActionArea>
    </Card>
  );
};

export default GroupsHomeCard;

import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/format';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Classifica del gruppo. Le righe arrivano già ordinate e con la posizione dal server
// (api/groups/read.php); qui cambia solo cosa si mostra per ogni scheda.
const MEDALS = { 1: '#d4a017', 2: '#9e9e9e', 3: '#b87333' };

const Metric = ({ row, board }) => {
  const { t } = useTranslation();
  if (board === 'streak') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        <Typography sx={{ fontWeight: 700 }}>
          {t('groups.board.streak_weeks', { count: row.streak_weeks })}
        </Typography>
      </Box>
    );
  }
  if (board === 'level') {
    return (
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontWeight: 700 }}>{t('groups.board.level', { level: row.level })}</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{row.total_xp.toLocaleString(intlLocale())} XP</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{row.workouts}/{row.goal}</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{row.volume_kg.toLocaleString(intlLocale())} kg</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.round(row.adherence * 100)}
        aria-label={t('groups.board.progress_label', { done: row.workouts, goal: row.goal })}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
};

const LeaderboardTable = ({ rows, board }) => {
  const { t } = useTranslation();
  // La barra della settimana è larga: sul telefono va sotto il nome, altrimenti il nome
  // resta di due lettere.
  const wide = board !== 'streak' && board !== 'level';
  if (!rows?.length) {
    return <Typography sx={{ color: 'text.secondary', py: 2 }}>{t('groups.board.empty')}</Typography>;
  }
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {rows.map((row) => (
        <Box
          component="li"
          key={row.username}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: wide ? { xs: 'wrap', sm: 'nowrap' } : 'nowrap',
            columnGap: 2,
            rowGap: 1,
            py: 1.5,
            px: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            borderRadius: row.is_me ? '10px' : 0,
            bgcolor: row.is_me ? 'action.selected' : 'transparent',
          }}
        >
          <Typography
            sx={{
              width: 28,
              textAlign: 'center',
              fontFamily: TITLE_FONT_FAMILY,
              fontWeight: 800,
              fontSize: 18,
              color: MEDALS[row.rank] || 'text.secondary',
            }}
          >
            {row.rank}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.username}
            </Typography>
            {row.is_me && <Chip label={t('groups.board.me')} size="small" variant="outlined" sx={{ height: 24, fontSize: 14, color: 'text.primary', borderColor: 'text.secondary' }} />}
          </Box>
          <Box sx={wide ? { width: { xs: '100%', sm: 'auto' }, pl: { xs: '44px', sm: 0 } } : undefined}>
            <Metric row={row} board={board} />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default LeaderboardTable;

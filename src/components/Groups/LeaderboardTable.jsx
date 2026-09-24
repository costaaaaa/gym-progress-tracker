import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

// Classifica del gruppo. Le righe arrivano già ordinate e con la posizione dal server
// (api/groups/read.php); qui cambia solo cosa si mostra per ogni scheda.
const MEDALS = { 1: '#d4a017', 2: '#9e9e9e', 3: '#b87333' };

const Metric = ({ row, board }) => {
  if (board === 'streak') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        <Typography sx={{ fontWeight: 700 }}>
          {row.streak_weeks} {row.streak_weeks === 1 ? 'settimana' : 'settimane'}
        </Typography>
      </Box>
    );
  }
  if (board === 'level') {
    return (
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontWeight: 700 }}>Livello {row.level}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{row.total_xp.toLocaleString('it-IT')} XP</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.workouts}/{row.goal}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{row.volume_kg.toLocaleString('it-IT')} kg</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.round(row.adherence * 100)}
        aria-label={`${row.workouts} allenamenti su ${row.goal}`}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
};

const LeaderboardTable = ({ rows, board }) => {
  if (!rows?.length) {
    return <Typography sx={{ color: 'text.secondary', py: 2 }}>Nessun membro in classifica.</Typography>;
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
            gap: 2,
            py: 1.5,
            px: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            borderRadius: row.is_me ? '10px' : 0,
            bgcolor: row.is_me ? (theme) => (theme.palette.mode === 'light' ? '#fbebeb' : 'rgba(213, 0, 0, 0.12)') : 'transparent',
          }}
        >
          <Typography
            sx={{
              width: 28,
              textAlign: 'center',
              fontFamily: '"Lexend", sans-serif',
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
            {row.is_me && <Chip label="tu" size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />}
          </Box>
          <Metric row={row} board={board} />
        </Box>
      ))}
    </Box>
  );
};

export default LeaderboardTable;

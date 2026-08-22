import React, { useState, useEffect } from 'react';
import { Box, Card, CardActionArea, LinearProgress, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { Link as RouterLink } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const LevelCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}api/gamification/profile.php`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.success) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const { level, xp_into_level, xp_for_next_level, total_xp } = data;
  const progress = xp_for_next_level > 0
    ? Math.round((xp_into_level / xp_for_next_level) * 100)
    : 100;

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={RouterLink} to="/profilo" sx={{ height: '100%', p: '22px' }}>
        <Typography
          sx={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 2 }}
        >
          Livello
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon sx={{ fontSize: 30, color: 'primary.main' }} />
            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 30, lineHeight: 1, color: 'primary.main' }}>
              {level}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 120 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{xp_into_level} XP</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{xp_for_next_level} XP</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'divider',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #d50000, #ff5131)',
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {total_xp.toLocaleString()} XP totali
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'primary.main', fontWeight: 600 }}>
              Vedi profilo →
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default LevelCard;

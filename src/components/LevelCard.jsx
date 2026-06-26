import React, { useState, useEffect } from 'react';
import { Box, Card, CardActionArea, CardContent, LinearProgress, Typography } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
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
    <Card sx={{ borderRadius: 3 }}>
      <CardActionArea component={RouterLink} to="/profilo">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Livello</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEventsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1 }}>
                  {level}
                </Typography>
                <Typography variant="caption" color="text.secondary">livello</Typography>
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 120 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{xp_into_level} XP</Typography>
                <Typography variant="caption" color="text.secondary">{xp_for_next_level} XP</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {progress}% al livello {level + 1}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                {total_xp.toLocaleString()} XP totali
              </Typography>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                Vedi profilo →
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default LevelCard;

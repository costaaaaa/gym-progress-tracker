import { useState, useEffect } from 'react';
import { Box, Card, CardActionArea, LinearProgress, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { Link as RouterLink } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n/format';
import { TITLE_FONT_FAMILY } from '../utils/fonts';

const LevelCard = () => {
  const { t } = useTranslation();
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
          component="h2"
          variant="cardTitle"
          sx={{ mb: 2 }}
        >
          {t('level.title')}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon sx={{ fontSize: 30 }} />
            <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
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
                borderRadius: '4px',
                bgcolor: 'divider',
                '& .MuiLinearProgress-bar': {
                  borderRadius: '4px',
                  bgcolor: 'primary.main',
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {t('level.total_xp', { xp: formatNumber(total_xp) })}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>
              {t('level.see_profile')}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default LevelCard;

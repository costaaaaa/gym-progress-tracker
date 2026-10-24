import { useState, useEffect } from 'react';
import { Box, Card, CircularProgress, Grid, LinearProgress, Typography } from '@mui/material';
import PrototypeSwitcher, { useVariant } from '../components/PrototypeSwitcher';
import { AchievementVariants, ACH_VARIANT_NAMES } from './prototype31/AchievementVariants';
import { API_BASE_URL } from '../config';
import { xpIntoLevel, xpForNextLevel } from '../utils/gamificationLevels';
import { intlLocale } from '../i18n/format';
import { TITLE_FONT_FAMILY } from '../utils/fonts';

function exProgressPct(xp) {
  const xpNum = parseInt(xp, 10);
  const span = xpForNextLevel(xpNum);
  return span > 0 ? Math.round((xpIntoLevel(xpNum) / span) * 100) : 100;
}

const Achievements = ({ data }) => {
  const V = AchievementVariants[useVariant(['A', 'B', 'C', 'D'])];
  return <V data={data} />;
};

const ProfileSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}api/gamification/profile.php`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.success) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 8 }}>
        Profilo non disponibile.
      </Typography>
    );
  }

  const {
    level, total_xp, xp_into_level, xp_for_next_level,
    lifetime_volume_kg, total_sessions, longest_streak,
    exercises,
  } = data;

  const progress = xp_for_next_level > 0
    ? Math.round((xp_into_level / xp_for_next_level) * 100)
    : 100;

  const statTiles = [
    { value: total_sessions, label: 'sessioni' },
    { value: `${Math.round(lifetime_volume_kg).toLocaleString(intlLocale())} kg`, label: 'tonnellaggio a vita' },
    { value: longest_streak, label: 'settimane record' },
  ];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Card livello */}
      <Card sx={{ p: '26px', mb: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
          <Box>
            <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
              Livello {level}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
              {total_xp.toLocaleString(intlLocale())} XP totali
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{xp_into_level} XP</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {xp_for_next_level} XP per livello {level + 1}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 9,
              borderRadius: '5px',
              bgcolor: 'divider',
              '& .MuiLinearProgress-bar': {
                borderRadius: '5px',
                bgcolor: 'primary.main',
              },
            }}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', justifyContent: 'start', columnGap: { xs: 3, md: 5 } }}>
          {statTiles.map((stat) => (
            <Box key={stat.label}>
              <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>{stat.label}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {/* Livelli per esercizio — precede Achievement */}
      {exercises.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="cardTitle" sx={{ mb: 2 }}>
            Livelli per esercizio
          </Typography>
          <Grid container spacing={2}>
            {exercises.map(ex => (
              <Grid item xs={12} sm={6} key={ex.exercise_id}>
                <Card sx={{ borderRadius: '14px', p: '18px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.name}
                    </Typography>
                    <Box sx={{
                      bgcolor: 'action.selected',
                      color: 'text.primary',
                      fontSize: 13,
                      fontWeight: 800,
                      borderRadius: '999px',
                      px: 1.25,
                      py: 0.25,
                      ml: 1,
                      flexShrink: 0,
                    }}>
                      Lv {ex.level}
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={exProgressPct(ex.xp)}
                    sx={{
                      height: 6,
                      borderRadius: '3px',
                      bgcolor: 'divider',
                      mb: 0.75,
                      '& .MuiLinearProgress-bar': { borderRadius: '3px', bgcolor: 'primary.main' },
                    }}
                  />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{ex.xp} XP</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Achievements data={data} />
      <PrototypeSwitcher variants={['A', 'B', 'C', 'D']} names={ACH_VARIANT_NAMES} />
    </Box>
  );
};

export default ProfileSummary;

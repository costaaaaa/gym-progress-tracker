import React, { useState, useEffect } from 'react';
import { Box, Card, CircularProgress, Grid, LinearProgress, Tooltip, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { API_BASE_URL } from '../config';
import { xpIntoLevel, xpForNextLevel } from '../utils/gamificationLevels';

// Solo queste tre categorie hanno una griglia dedicata: "strength" è esclusa perché il suo
// ruolo è coperto dalla sezione "Livelli per Esercizio" (il catalogo backend resta invariato).
const CATEGORY_ORDER = ['sessions', 'tonnage', 'streak'];
const CATEGORY_LABEL = {
  sessions: 'Sessioni',
  tonnage:  'Tonnellaggio',
  streak:   'Costanza',
};

function exProgressPct(xp) {
  const xpNum = parseInt(xp, 10);
  const span = xpForNextLevel(xpNum);
  return span > 0 ? Math.round((xpIntoLevel(xpNum) / span) * 100) : 100;
}

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
    exercises, achievements,
  } = data;

  const progress = xp_for_next_level > 0
    ? Math.round((xp_into_level / xp_for_next_level) * 100)
    : 100;

  const byCategory = {};
  achievements.forEach(a => {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  });

  const statTiles = [
    { value: total_sessions, label: 'sessioni' },
    { value: `${Math.round(lifetime_volume_kg).toLocaleString()} kg`, label: 'tonnellaggio a vita' },
    { value: longest_streak, label: 'settimane record' },
  ];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Card livello */}
      <Card sx={{ p: '26px', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
          <StarIcon sx={{ fontSize: 44, color: 'primary.main' }} />
          <Box>
            <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
              Livello {level}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
              {total_xp.toLocaleString()} XP totali
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
                background: 'linear-gradient(90deg, #d50000, #ff5131)',
              },
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {statTiles.map((stat) => (
            <Box key={stat.label}>
              <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 800, fontSize: 19, lineHeight: 1 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{stat.label}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {/* Livelli per Esercizio — precede Achievement */}
      {exercises.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2 }}>
            Livelli per Esercizio
          </Typography>
          <Grid container spacing={2}>
            {exercises.map(ex => (
              <Grid item xs={12} sm={6} key={ex.exercise_id}>
                <Card sx={{ borderRadius: '14px', p: '18px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.name}
                    </Typography>
                    <Box sx={{
                      bgcolor: 'primary.main',
                      color: '#fff',
                      fontSize: 11,
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
                      '& .MuiLinearProgress-bar': { borderRadius: '3px', background: 'linear-gradient(90deg, #d50000, #ff5131)' },
                    }}
                  />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{ex.xp} XP</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Achievement — solo sessions / tonnage / streak, "strength" esclusa dal rendering */}
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 2 }}>
        Achievement
      </Typography>
      {CATEGORY_ORDER.filter(cat => byCategory[cat]?.length).map(cat => (
        <Box key={cat} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', mb: 1.25 }}>
            {CATEGORY_LABEL[cat]}
          </Typography>
          <Grid container spacing={1.5}>
            {byCategory[cat].map(a => (
              <Grid item xs={6} sm={3} key={a.key}>
                <Tooltip
                  title={a.locked
                    ? `Soglia: ${a.threshold}`
                    : a.unlocked_at
                      ? new Date(a.unlocked_at).toLocaleDateString('it-IT')
                      : ''}
                  placement="top"
                >
                  <Card sx={{
                    borderRadius: '12px',
                    p: '16px 10px',
                    textAlign: 'center',
                    opacity: a.locked ? 0.5 : 1,
                    border: a.locked ? '1px solid' : '2px solid',
                    borderColor: a.locked ? 'divider' : 'primary.main',
                    cursor: 'default',
                    height: '100%',
                  }}>
                    {a.locked
                      ? <LockOutlinedIcon sx={{ fontSize: 24, color: 'text.disabled', mb: 0.75 }} />
                      : <StarIcon sx={{ fontSize: 24, color: 'primary.main', mb: 0.75 }} />
                    }
                    <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                      {a.label}
                    </Typography>
                  </Card>
                </Tooltip>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default ProfileSummary;

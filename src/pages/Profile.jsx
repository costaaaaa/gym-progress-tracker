import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Chip, CircularProgress, Grid,
  LinearProgress, Tooltip, Typography
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import { API_BASE_URL } from '../config';
import { xpIntoLevel, xpForNextLevel } from '../utils/gamificationLevels';

const CATEGORY_LABEL = {
  sessions: 'Sessioni',
  tonnage:  'Tonnellaggio',
  strength: 'Forza',
  streak:   'Costanza',
};

function exProgressPct(xp) {
  const xpNum = parseInt(xp, 10);
  const span = xpForNextLevel(xpNum);
  return span > 0 ? Math.round((xpIntoLevel(xpNum) / span) * 100) : 100;
}

const Profile = () => {
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

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header livello */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <EmojiEventsIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
                Livello {level}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {total_xp.toLocaleString()} XP totali
              </Typography>
            </Box>
          </Box>
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{xp_into_level} XP</Typography>
              <Typography variant="caption" color="text.secondary">
                {xp_for_next_level} XP per livello {level + 1}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>{total_sessions}</Typography>
              <Typography variant="caption" color="text.secondary">sessioni</Typography>
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {Math.round(lifetime_volume_kg).toLocaleString()} kg
              </Typography>
              <Typography variant="caption" color="text.secondary">tonnellaggio a vita</Typography>
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800}>{longest_streak}</Typography>
              <Typography variant="caption" color="text.secondary">settimane record</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Achievement */}
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Achievement</Typography>
      {Object.entries(byCategory).map(([cat, items]) => (
        <Box key={cat} sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            {CATEGORY_LABEL[cat] || cat}
          </Typography>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            {items.map(a => (
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
                    borderRadius: 2,
                    opacity: a.locked ? 0.45 : 1,
                    border: a.locked ? '1px solid' : '2px solid',
                    borderColor: a.locked ? 'divider' : 'primary.main',
                    cursor: 'default',
                    height: '100%',
                  }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
                      {a.locked
                        ? <LockIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }} />
                        : <EmojiEventsIcon sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
                      }
                      <Typography variant="caption" display="block" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                        {a.label}
                      </Typography>
                    </CardContent>
                  </Card>
                </Tooltip>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* Livelli per-esercizio */}
      {exercises.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, mt: 1 }}>Livelli per Esercizio</Typography>
          <Grid container spacing={2}>
            {exercises.map(ex => (
              <Grid item xs={12} sm={6} key={ex.exercise_id}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                        <FitnessCenterIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {ex.name}
                        </Typography>
                      </Box>
                      <Chip
                        label={`Lv ${ex.level}`}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 800, ml: 1, flexShrink: 0 }}
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={exProgressPct(ex.xp)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" color="text.secondary">{ex.xp} XP</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Profile;

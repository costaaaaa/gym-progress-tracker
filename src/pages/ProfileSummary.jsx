import { useState, useEffect } from 'react';
import { Box, Card, CircularProgress, Grid, LinearProgress, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { xpIntoLevel, xpForNextLevel } from '../utils/gamificationLevels';
import { formatDate, formatNumber } from '../i18n/format';
import { TITLE_FONT_FAMILY } from '../utils/fonts';

// Solo queste tre categorie hanno una griglia dedicata: "strength" è esclusa perché il suo
// ruolo è coperto dalla sezione "Livelli per esercizio" (il catalogo backend resta invariato).
const CATEGORY_ORDER = ['sessions', 'tonnage', 'streak'];

const BORDERED = { boxShadow: 'none', border: '1px solid', borderColor: 'divider' };
const solidBar = (height, color = 'primary.main') => ({
  height,
  borderRadius: `${height / 2}px`,
  bgcolor: 'divider',
  '& .MuiLinearProgress-bar': { borderRadius: `${height / 2}px`, bgcolor: color },
});

function exProgressPct(xp) {
  const xpNum = parseInt(xp, 10);
  const span = xpForNextLevel(xpNum);
  return span > 0 ? Math.round((xpIntoLevel(xpNum) / span) * 100) : 100;
}

// Valore attuale e soglia di una tappa, come testo ("58 di 100", "184 t di 420 t")
const progressOf = (t, cat, data, achievement) => {
  const tonnes = (kg) => t('profile.achievements.tonnes', { value: formatNumber(kg / 1000, { maximumFractionDigits: 1 }) });
  const current = { sessions: data.total_sessions, tonnage: data.lifetime_volume_kg, streak: data.longest_streak }[cat];
  const text = cat === 'tonnage'
    ? [tonnes(current), tonnes(achievement.threshold)]
    : [formatNumber(current), formatNumber(achievement.threshold)];
  return { pct: Math.min(100, (current / achievement.threshold) * 100), label: t('profile.achievements.progress', { current: text[0], target: text[1] }) };
};

const AchievementCard = ({ achievement, isNext, progress }) => {
  const { t } = useTranslation();
  const { label, locked, unlocked_at } = achievement;
  return (
    <Card sx={{
      ...BORDERED, borderRadius: '12px', p: '16px 12px', textAlign: 'center', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      ...(isNext && { borderColor: 'text.primary' }),
    }}>
      {!locked && <CheckIcon sx={{ fontSize: 22, color: 'success.main', mb: 0.75 }} />}
      {locked && !isNext && <LockOutlinedIcon sx={{ fontSize: 22, color: 'text.disabled', mb: 0.75 }} />}
      {isNext && <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>{t('profile.achievements.next')}</Typography>}
      <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: locked && !isNext ? 'text.secondary' : 'text.primary' }}>{label}</Typography>
      {!locked && unlocked_at && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          {formatDate(String(unlocked_at).replace(' ', 'T'), { day: 'numeric', month: 'short', year: 'numeric' })}
        </Typography>
      )}
      {isNext && (
        <Box sx={{ width: '100%', mt: 'auto', pt: 1 }}>
          <LinearProgress variant="determinate" value={progress.pct} sx={{ ...solidBar(6, 'text.primary'), mb: 0.75 }} />
          <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{progress.label}</Typography>
        </Box>
      )}
    </Card>
  );
};

const ProfileSummary = () => {
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
        {t('profile.unavailable')}
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
    { value: formatNumber(total_sessions), label: t('profile.stat.sessions') },
    { value: formatNumber(Math.round(lifetime_volume_kg)), label: t('profile.stat.volume') },
    { value: formatNumber(longest_streak), label: t('profile.stat.streak') },
  ];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Card livello */}
      <Card sx={{ ...BORDERED, p: { xs: 2.5, sm: '26px' }, mb: 3 }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
            {t('profile.level', { level })}
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
            {t('level.total_xp', { xp: formatNumber(total_xp) })}
          </Typography>
        </Box>

        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('profile.xp_current', { xp: xp_into_level })}</Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              {t('profile.xp_to_next', { xp: xp_for_next_level, level: level + 1 })}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={solidBar(9)} />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', justifyContent: 'start', columnGap: { xs: 3, md: 5 } }}>
          {statTiles.map((stat) => (
            <Box key={stat.label}>
              <Typography variant="statNumber">{stat.value}</Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5, whiteSpace: 'nowrap' }}>{stat.label}</Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {/* Livelli per esercizio — precede i traguardi */}
      {exercises.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="cardTitle" sx={{ mb: 2 }}>
            {t('profile.exercises_title')}
          </Typography>
          <Grid container spacing={2}>
            {exercises.map(ex => (
              <Grid item xs={12} sm={6} key={ex.exercise_id}>
                <Card sx={{ ...BORDERED, borderRadius: '14px', p: '18px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.name}
                    </Typography>
                    <Box sx={{
                      bgcolor: 'action.selected',
                      color: 'text.primary',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: '999px',
                      px: 1.25,
                      py: 0.25,
                      ml: 1,
                      flexShrink: 0,
                    }}>
                      {t('profile.exercise_level', { level: ex.level })}
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={exProgressPct(ex.xp)} sx={{ ...solidBar(6), mb: 0.75 }} />
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('profile.xp_current', { xp: ex.xp })}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Traguardi — solo sessions / tonnage / streak, "strength" esclusa dal rendering */}
      <Typography variant="cardTitle" sx={{ mb: 2 }}>
        {t('profile.achievements.title')}
      </Typography>
      {CATEGORY_ORDER.filter(cat => byCategory[cat]?.length).map(cat => {
        const items = byCategory[cat];
        const next = items.find((a) => a.locked);
        return (
          <Box key={cat} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.25 }}>
              <Typography variant="cardTitle" sx={{ fontSize: 16 }}>{t(`profile.achievements.category.${cat}`)}</Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {t('profile.achievements.count', { earned: items.filter((a) => !a.locked).length, total: items.length })}
              </Typography>
            </Box>
            <Grid container spacing={1.5}>
              {items.map(a => (
                <Grid item xs={6} sm={3} key={a.key}>
                  <AchievementCard achievement={a} isNext={a === next} progress={a === next ? progressOf(t, cat, data, a) : null} />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}
    </Box>
  );
};

export default ProfileSummary;

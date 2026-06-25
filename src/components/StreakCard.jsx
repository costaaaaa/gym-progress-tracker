import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { API_BASE_URL } from '../config';

const StreakCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}api/gamification/streak.php`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.success) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) return null;

  const { current_streak_weeks, longest_streak_weeks, this_week } = data;
  const progress = this_week.goal > 0
    ? Math.min(100, Math.round((this_week.count / this_week.goal) * 100))
    : 0;
  const streakColor = current_streak_weeks > 0 ? 'warning.main' : 'text.disabled';

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Streak</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>

          {/* Flame + streak count */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 40, color: streakColor }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: streakColor, lineHeight: 1 }}>
                {current_streak_weeks}
              </Typography>
              <Typography variant="caption" color="text.secondary">settimane</Typography>
            </Box>
          </Box>

          {/* Progress ring: this week */}
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={100}
              size={64}
              thickness={4}
              sx={{ color: 'action.hover', position: 'absolute', top: 0, left: 0 }}
            />
            <CircularProgress
              variant="determinate"
              value={progress}
              size={64}
              thickness={4}
              color={this_week.completed ? 'success' : 'primary'}
            />
            <Box sx={{
              top: 0, left: 0, bottom: 0, right: 0,
              position: 'absolute', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Typography variant="caption" fontWeight="bold">
                {this_week.count}/{this_week.goal}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary">
              {this_week.completed
                ? '✅ Settimana completata!'
                : `${this_week.goal - this_week.count} sessioni al traguardo`}
            </Typography>
            {longest_streak_weeks > 0 && (
              <Typography variant="caption" color="text.secondary">
                Record: {longest_streak_weeks} settimane
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StreakCard;

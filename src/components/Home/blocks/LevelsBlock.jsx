import { Box, LinearProgress, Typography } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useTranslation } from 'react-i18next';
import BlockShell from './BlockShell';
import { useBlockData } from './useBlockData';
import { readJson, isSuccess } from '../../../utils/readJson';
import { formatNumber } from '../../../i18n/format';
import { TITLE_FONT_FAMILY } from '../../../utils/fonts';

// Livello e punti, e le settimane di fila: tutte e due le letture devono essere buone
const load = async () => {
  const [profile, streak] = await Promise.all([
    readJson('api/gamification/profile.php', isSuccess),
    readJson('api/gamification/streak.php', isSuccess),
  ]);
  return profile && streak ? { profile, weeks: Number(streak.current_streak_weeks) || 0 } : null;
};

const LevelsBlock = ({ large = false }) => {
  const { t } = useTranslation();
  const { status, data } = useBlockData(load);
  const { profile, weeks } = data ?? {};
  const level = profile?.level;
  const summary = weeks > 0 ? t('home.block.levels_line', { level, count: weeks }) : t('groups.board.level', { level });
  const progress = profile?.xp_for_next_level > 0 ? Math.round((profile.xp_into_level / profile.xp_for_next_level) * 100) : 100;
  return (
    <BlockShell
      title={t('home.block.levels_title')}
      to="/livelli"
      status={status}
      summary={summary}
      sign={weeks > 0 ? <LocalFireDepartmentIcon aria-hidden sx={{ fontSize: 26, color: 'warning.text' }} /> : null}
      large={large}
      contentRepeatsSummary
    >
      {status === 'ok' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {weeks > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalFireDepartmentIcon aria-hidden sx={{ fontSize: 36, color: 'warning.text' }} />
              <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{weeks}</Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t('home.block.streak_label', { count: weeks })}</Typography>
            </Box>
          )}
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{t('groups.board.level', { level })}</Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              {t('home.block.points', { current: formatNumber(profile.xp_into_level), next: formatNumber(profile.xp_for_next_level) })}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            aria-label={t('level.progress_aria', { level: level + 1 })}
            sx={{ height: 8, borderRadius: '4px', bgcolor: 'divider', '& .MuiLinearProgress-bar': { borderRadius: '4px', bgcolor: 'primary.main' } }}
          />
        </Box>
      )}
    </BlockShell>
  );
};

export default LevelsBlock;

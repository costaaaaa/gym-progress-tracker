import { Box, Card, Chip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RECENT_DAYS, MAX_PR_CHIPS } from '../../utils/progressOverview';

const SummaryStat = ({ label, value, color }) => (
  <Box sx={{ flex: '0 0 auto' }}>
    <Typography variant="statNumber" sx={{ color: value === 0 ? 'text.secondary' : color }}>{value}</Typography>
    <Typography sx={{ fontSize: 16, color: 'text.secondary', whiteSpace: 'nowrap' }}>{label}</Typography>
  </Box>
);

// La card del riepilogo («Ultimi N giorni»): quanti esercizi crescono, sono fermi o calano, quanti record nuovi; i record
// (fino a MAX_PR_CHIPS) sono chip-collegamento alla pagina dell'esercizio. `summary`: il risultato di summarize.
const ProgressSummary = ({ summary }) => {
  const { t } = useTranslation();
  return (
    <Card sx={{ p: { xs: 2, sm: '20px 22px' } }}>
      <Typography variant="cardTitle" sx={{ mb: 1.5 }}>{t('progress.summary.title', { days: RECENT_DAYS })}</Typography>
      <Box sx={{ display: 'flex', justifyContent: { xs: 'space-between', md: 'flex-start' }, gap: { xs: 2, md: 6 } }}>
        <SummaryStat label={t('progress.summary.improving')} value={summary.improving} color="success.main" />
        <SummaryStat label={t('progress.summary.stalled')} value={summary.stalled} />
        <SummaryStat label={t('progress.summary.declining')} value={summary.declining} color="recovery.recovering" />
        <SummaryStat label={t('progress.summary.prs')} value={summary.prs.length} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
        {summary.prs.length === 0 ? (
          <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t(summary.allNew ? 'progress.summary.prs_need_second' : 'progress.summary.prs_none')}</Typography>
        ) : (
          <>
            {summary.prs.slice(0, MAX_PR_CHIPS).map((a) => (
              <Chip
                key={a.id}
                component={RouterLink}
                to={`/progressi/esercizi/${a.id}`}
                clickable
                variant="outlined"
                label={`${t('progress.pr')} · ${a.name}`}
                sx={{ height: 44, minHeight: 44, fontSize: 16, color: 'text.primary', borderColor: 'text.secondary', maxWidth: '100%' }}
              />
            ))}
            {summary.prs.length > MAX_PR_CHIPS && (
              <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>+{summary.prs.length - MAX_PR_CHIPS}</Typography>
            )}
          </>
        )}
      </Box>
    </Card>
  );
};

export default ProgressSummary;

import { Box, Typography, Button, TextField, Paper } from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { intlLocale } from '../../i18n/format';

// Oltre questa età la bozza è una sessione dimenticata: il backend non usa più start_time da solo
const DRAFT_STALE_MS = 4 * 60 * 60 * 1000;
const RETRO_MAX_DAYS = 7;

const draftIsStale = (draft) => Date.now() - new Date(draft.startTime).getTime() > DRAFT_STALE_MS;

const toDateInputValue = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Bozza trovata all'apertura: riprendi, scarta, oppure (se vecchia) chiudila come già finita su un giorno scelto
export default function ResumePromptPhase({ draftToResume, retroDateInput, onRetroDateChange, onResume, onFinished, onDiscard }) {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  const stale = draftIsStale(draftToResume);
  const today = new Date();
  const minDay = new Date(today);
  minDay.setDate(minDay.getDate() - RETRO_MAX_DAYS);
  const retroDateBounds = { min: toDateInputValue(minDay), max: toDateInputValue(today) };
  const startDay = toDateInputValue(new Date(draftToResume.startTime));
  retroDateBounds.initial = startDay < retroDateBounds.min ? retroDateBounds.min : startDay;
  const chosenRetro = retroDateInput || retroDateBounds.initial;
  const retroDateValid = chosenRetro >= retroDateBounds.min && chosenRetro <= retroDateBounds.max;
  return (
    <Box sx={{ 
      minHeight: '100vh', bgcolor: colors.bg, color: colors.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3
    }}>
      <Paper sx={{
        bgcolor: colors.bgCard, p: 4, maxWidth: 400, textAlign: 'center',
        border: `1px solid ${colors.border}`,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        <HistoryIcon sx={{ fontSize: 64, color: colors.warning, mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          {t('focus.draft_title')}
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 1 }}>
          {t('focus.draft_text')}
        </Typography>
        <Typography variant="h6" sx={{ color: colors.primaryLight, fontWeight: 600, mb: 1 }}>
          {draftToResume.selectedDay?.name}
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textMuted, mb: 3 }}>
          {t('focus.draft_started', { date: new Date(draftToResume.startTime).toLocaleString(intlLocale()) })}
        </Typography>

        {stale && (
          <Box sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1.5 }}>
              {t('focus.draft_retro_hint')}
            </Typography>
            <TextField
              type="date"
              label={t('focus.draft_retro_day')}
              value={chosenRetro}
              onChange={(e) => onRetroDateChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: retroDateBounds.min, max: retroDateBounds.max }}
              fullWidth
              sx={{ mb: 1.5 }}
            />
            <Button
              variant="outlined"
              fullWidth
              disabled={!retroDateValid}
              onClick={() => onFinished(chosenRetro)}
              sx={{ color: colors.primaryLight, borderColor: colors.primary, py: 1.25, fontWeight: 700 }}
            >
              {t('focus.draft_retro_done')}
            </Button>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={onResume}
            sx={{
              bgcolor: colors.primary, py: 1.5, fontWeight: 700,
              '&:hover': { bgcolor: colors.primaryDark }
            }}
          >
            {stale ? t('focus.draft_continue_now') : t('focus.draft_resume')}
          </Button>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            onClick={onDiscard}
            sx={{
              color: colors.textSecondary, borderColor: colors.border, py: 1.5,
              '&:hover': { borderColor: colors.primary, color: colors.primaryLight }
            }}
          >
            {t('focus.draft_discard')}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

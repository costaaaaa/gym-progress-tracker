import { useState } from 'react';
import { Paper, Box, Typography, Button, IconButton } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseIcon from '@mui/icons-material/Close';
import { STORE_LINKS } from '../config';
import { track } from '../utils/analytics';
import { useTranslation } from 'react-i18next';

const DISMISSED_KEY = 'healthAppHintDismissed';

// iPhone/iPad o Android, solo per scegliere il link giusto. Lo user agent si legge qui nel
// browser e non esce dal dispositivo (privacy.html, sezione 11).
// iPadOS si presenta come un Mac: lo riconosce lo schermo touch.
export const detectPlatform = (nav = window.navigator) => {
  const ua = nav.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
};

const COPY = {
  ios: { source: 'health_hint.source_ios', store: 'App Store' },
  android: { source: 'health_hint.source_android', store: 'Play Store' },
};

const isDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

// Misure corporee aperte dal browser del telefono: ricorda che con l'app peso e grasso arrivano
// da Apple Salute / Health Connect. Niente su computer, se l'app non è ancora nello store di quel
// telefono (STORE_LINKS vuoto), se l'utente sincronizza già o se l'ha chiuso.
const HealthAppHint = ({ alreadySyncing = false }) => {
  const { t } = useTranslation();
  const [platform] = useState(detectPlatform);
  const [dismissed, setDismissed] = useState(isDismissed);

  if (!platform || !STORE_LINKS[platform] || alreadySyncing || dismissed) return null;
  const { source, store } = COPY[platform];

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // senza memoria locale riapparirà alla prossima visita, pazienza
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1.5, pr: 1, py: 1, mb: 3, borderRadius: '14px' }}
    >
      <Box
        sx={{
          flexShrink: 0, width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
          bgcolor: 'rgba(255, 45, 85, 0.1)',
        }}
      >
        <FavoriteIcon sx={{ fontSize: 16, color: '#ff2d55' }} />
      </Box>
      <Typography sx={{ flex: 1, fontSize: 13, color: 'text.secondary', lineHeight: 1.35 }}>
        {t('health_hint.text', { source: t(source) })}
      </Typography>
      <Button
        size="small"
        href={STORE_LINKS[platform]}
        target="_blank"
        rel="noopener"
        onClick={() => track('health-app-hint', { platform })}
        sx={{ flexShrink: 0, fontWeight: 700 }}
        aria-label={t('health_hint.download_aria', { store })}
      >
        {t('health_hint.download')}
      </Button>
      <IconButton size="small" onClick={dismiss} aria-label={t('health_hint.dismiss')} sx={{ ml: -0.5 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
};

export default HealthAppHint;

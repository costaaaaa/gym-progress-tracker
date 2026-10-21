import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Chip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import BodyVisualizer from '../../components/BodyVisualizer';
import { CHIP_FONT } from '../../utils/chipFont';
import { track } from '../../utils/analytics';
import { useLocalizedPath } from '../../i18n/paths';

// Esempi precalcolati a circa 24 ore dall'allenamento: [stato, percentuale, giorni al "pronto"].
// Non c'è nessuna formula nel client: sono dati di esempio, dichiarati tali sotto la card.
const R = ['PRONTO', 100, 0];
const SETS = {
  none: {},
  push: { petto: ['AFFATICATO', 30, 3], spalle: ['IN RECUPERO', 50, 2], tricipiti: ['IN RECUPERO', 55, 1] },
  pull: { schiena: ['AFFATICATO', 32, 2], bicipiti: ['IN RECUPERO', 55, 1], spalle: ['IN RECUPERO', 70, 1] },
  legs: {
    quadricipiti: ['AFFATICATO', 28, 3],
    glutei: ['IN RECUPERO', 45, 2],
    femorali: ['IN RECUPERO', 40, 2],
    polpacci: ['IN RECUPERO', 60, 1],
  },
};
const MUSCLES = ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'polpacci'];
const OPTIONS = ['none', 'push', 'pull', 'legs'];
const DEFAULT_OPTION = 'push';

const pad = (n) => String(n).padStart(2, '0');
const toReadyAt = (days) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

const buildRecovery = (option) =>
  Object.fromEntries(
    MUSCLES.map((m) => {
      const [status, percent, days] = SETS[option][m] || R;
      return [m, { status, percent, ready_at: days ? toReadyAt(days) : null }];
    }),
  );

const HeroRecovery = () => {
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  const [option, setOption] = useState(DEFAULT_OPTION);
  const recovery = useMemo(() => buildRecovery(option), [option]);
  const listRef = useRef(null);
  const firstRun = useRef(true);

  // Le barre si riempiono riga per riga: una volta al caricamento (tutto entro 1,2 s), più breve ai cambi di scelta.
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const first = firstRun.current;
    firstRun.current = false;
    const ctx = gsap.context(() => {
      gsap.from('[data-recovery-bar]', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: first ? 0.6 : 0.4,
        stagger: first ? 0.07 : 0.03,
        ease: 'power2.out',
      });
    }, listRef);
    return () => ctx.revert();
  }, [option]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1.05fr)' },
        gap: { xs: 4, md: 8 },
        alignItems: 'center',
        pt: { xs: 1, md: 4 },
        pb: { xs: 6, md: 10 },
      }}
    >
      <Box>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: '2.25rem', md: '3.5rem' }, lineHeight: 1.08, mb: 2.5 }}
        >
          {t('home.landing.hero.title')}
        </Typography>
        <Typography sx={{ fontSize: { xs: 17, md: 19 }, color: 'text.primary', lineHeight: 1.55, mb: 3.5, maxWidth: 520 }}>
          {t('home.landing.hero.sub')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to={localizedPath('/register')}
            onClick={() => track('landing_cta_click', { position: 'hero' })}
            sx={{ px: 4, py: 1.5, fontSize: 17, fontWeight: 700, borderRadius: '12px' }}
          >
            {t('home.hero.cta')}
          </Button>
          <Button
            component={RouterLink}
            to={localizedPath('/login')}
            color="inherit"
            sx={{ px: 2, py: 1.5, fontSize: 16, fontWeight: 600 }}
          >
            {t('home.hero.login')}
          </Button>
        </Box>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 2 }}>{t('home.hero.note')}</Typography>
      </Box>

      <Box>
        <Card data-ui sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 17, mb: 1.5 }}>
            {t('home.landing.hero.question')}
          </Typography>
          <Box role="group" aria-label={t('home.landing.hero.question')} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {OPTIONS.map((key) => {
              const selected = key === option;
              return (
                <Chip
                  key={key}
                  label={t(`home.landing.hero.opt.${key}`)}
                  onClick={() => setOption(key)}
                  aria-pressed={selected}
                  color={selected ? 'secondary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  sx={{ ...CHIP_FONT, fontSize: 16, height: 40, borderRadius: '20px', px: 0.5 }}
                />
              );
            })}
          </Box>
          <Box ref={listRef}>
            <BodyVisualizer recoveryData={recovery} />
          </Box>
        </Card>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 1.5 }}>{t('home.showcase.subtitle')}</Typography>
      </Box>
    </Box>
  );
};

export default HeroRecovery;

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Chip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import BodyVisualizer from '../../components/BodyVisualizer';
import { CHIP_FONT } from '../../utils/chipFont';
import { track } from '../../utils/analytics';
import { useLocalizedPath } from '../../i18n/paths';
import { buildRecovery } from './recoveryDemo';

const OPTIONS = ['none', 'push', 'pull', 'legs'];
const DEFAULT_OPTION = 'push';

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
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1.1fr)' },
        gap: { xs: 4, md: 8 },
        alignItems: 'center',
        // Su desktop il primo schermo è pieno: sotto la Navbar (64) e il margine del Layout (32).
        minHeight: { md: 'calc(100svh - 96px)' },
        pt: { xs: 1, md: 0 },
        pb: { xs: 6, md: 4 },
      }}
    >
      <Box>
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: '2.25rem', md: '4rem' }, lineHeight: 1.05, mb: 3 }}
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

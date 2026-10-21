import { useEffect, useRef } from 'react';
import { Box, Button, Card, Chip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { track } from '../../utils/analytics';
import { useLocalizedPath } from '../../i18n/paths';
import HeroRecovery from './HeroRecovery';
import SceneFocus from './SceneFocus';
import SceneProgress from './SceneProgress';

const FEATURES = ['plans', 'measures', 'charts'];
const PLAN_ROWS = [['ex1', '4 × 8'], ['ex2', '3 × 10'], ['ex3', '3 × 12']];

const PlanFragment = ({ t }) => (
  <Card data-ui aria-hidden="true" sx={{ p: { xs: 2.5, md: 3 }, mt: { xs: 3, md: 5 }, maxWidth: 440 }}>
    <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 22, mb: 2 }}>
      {t('home.landing.inside.plan.day')}
    </Typography>
    {PLAN_ROWS.map(([key, sets], i) => (
      <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
        <Typography sx={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{t(`home.landing.inside.plan.${key}`)}</Typography>
        {i === 2 && <Chip label={t('home.landing.inside.plan.tech')} size="small" sx={{ fontSize: 16, height: 32, borderRadius: '16px' }} />}
        <Typography sx={{ fontSize: 17, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, sans-serif', color: 'text.secondary' }}>{sets}</Typography>
      </Box>
    ))}
  </Card>
);

// Entrata discreta: una sola dissolvenza con piccolo scarto, solo se il movimento non è ridotto.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return undefined;
    const items = root.querySelectorAll('[data-reveal]');
    items.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(14px)';
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.transition = 'opacity .5s ease, transform .5s ease';
        e.target.style.opacity = '1';
        e.target.style.transform = 'none';
        io.unobserve(e.target);
      });
    }, { threshold: 0.2 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

const Inside = () => {
  const { t } = useTranslation();
  const ref = useReveal();
  return (
    <Box
      ref={ref}
      component="section"
      aria-labelledby="landing-inside-title"
      sx={{
        py: { xs: 8, md: 14 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
        gap: { xs: 4, md: 8 },
      }}
    >
      <Box>
        <Typography id="landing-inside-title" variant="h2" sx={{ fontSize: { xs: '1.75rem', md: '2.75rem' }, lineHeight: 1.1 }}>
          {t('home.landing.inside.title')}
        </Typography>
        <PlanFragment t={t} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3.5, md: 5 } }}>
        {FEATURES.map((key) => (
          <Box key={key} data-reveal>
            <Typography variant="h3" sx={{ fontSize: { xs: 22, md: 26 }, mb: 0.75 }}>
              {t(`home.feat.${key}.title`)}
            </Typography>
            <Typography sx={{ fontSize: { xs: 17, md: 18 }, lineHeight: 1.55, maxWidth: 560 }}>
              {t(`home.feat.${key}.text`)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const Closing = () => {
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  return (
    <Box component="section" aria-labelledby="landing-cta-title" sx={{ py: { xs: 8, md: 14 }, textAlign: 'center' }}>
      <Typography id="landing-cta-title" variant="h2" sx={{ fontSize: { xs: '1.75rem', md: '2.75rem' }, lineHeight: 1.1, mb: 3.5 }}>
        {t('home.footer.cta_title')}
      </Typography>
      <Button
        variant="contained"
        size="large"
        component={RouterLink}
        to={localizedPath('/register')}
        onClick={() => track('landing_cta_click', { position: 'footer' })}
        sx={{ px: 4, py: 1.5, fontSize: 17, fontWeight: 700, borderRadius: '12px' }}
      >
        {t('home.footer.cta')}
      </Button>
    </Box>
  );
};

const Landing = () => (
    <>
      <HeroRecovery />
      <SceneFocus />
      <Inside />
      <SceneProgress />
      <Closing />
    </>
);

export default Landing;

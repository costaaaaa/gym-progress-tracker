import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../i18n/format';
import { TABULAR } from '../../utils/tabularFont';
import { sceneSx, stageSx, useScrollScene } from './useScrollScene';

const TOTAL_SETS = 4;
const REST_SECONDS = 90;
const RING = { size: 208, stroke: 10 };
const STEPS = ['s1', 's2', 's3'];

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

// Timeline: .2-.34 conferma della serie, .38-.46 cambio schermata, .46-.80 recupero che scorre, .80-.95 fine e vibrazione.
function build(tl, q) {
  const time = { v: REST_SECONDS };
  tl.to(q('[data-confirm]'), { scale: 0.95, duration: 0.03 }, 0.2)
    .to(q('[data-confirm]'), { scale: 1, duration: 0.03 }, 0.23)
    .fromTo(q('[data-dot-fill]'), { scale: 0 }, { scale: 1, duration: 0.05 }, 0.24)
    .fromTo(q('[data-new-set]'), { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.25)
    .to(q('[data-step="s1"]'), { autoAlpha: 0, y: -16, duration: 0.05 }, 0.34)
    .fromTo(q('[data-step="s2"]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.38)
    .to(q('[data-screen="work"]'), { autoAlpha: 0, xPercent: -8, duration: 0.07 }, 0.38)
    .fromTo(q('[data-screen="rest"]'), { autoAlpha: 0, xPercent: 8 }, { autoAlpha: 1, xPercent: 0, duration: 0.07 }, 0.4)
    .fromTo(q('[data-ring]'), { strokeDashoffset: 0 }, { strokeDashoffset: 1, duration: 0.34 }, 0.46)
    .to(time, {
      v: 0,
      duration: 0.34,
      onUpdate: () => {
        const el = q('[data-clock]')[0];
        if (el) el.textContent = clock(time.v);
      },
    }, 0.46)
    .to(q('[data-step="s2"]'), { autoAlpha: 0, y: -16, duration: 0.05 }, 0.78)
    .fromTo(q('[data-step="s3"]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.82)
    .fromTo(q('[data-done]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04 }, 0.82)
    .to(q('[data-phone]'), { x: 5, duration: 0.012, repeat: 7, yoyo: true }, 0.82)
    .to(q('[data-phone]'), { x: 0, duration: 0.012 }, 0.92);
}

const Dot = ({ index, filled }) => (
  <Box
    sx={{
      width: 22,
      height: 22,
      borderRadius: '50%',
      border: '2px solid',
      borderColor: 'text.primary',
      bgcolor: filled ? 'text.primary' : 'transparent',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {index === 3 && (
      <Box data-dot-fill sx={{ position: 'absolute', inset: 0, bgcolor: 'text.primary', borderRadius: '50%' }} />
    )}
  </Box>
);

const Value = ({ label, value }) => (
  <Box sx={{ flex: 1, textAlign: 'center', py: 1.5, borderRadius: '12px', bgcolor: 'action.hover' }}>
    <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{label}</Typography>
    <Typography sx={{ ...TABULAR, fontWeight: 800, fontSize: 32, lineHeight: 1.2 }}>{value}</Typography>
  </Box>
);

const Phone = ({ children, sx }) => (
  <Box
    aria-hidden="true"
    data-phone
    data-ui
    sx={{
      width: 320,
      maxWidth: '100%',
      height: { xs: 'min(480px, calc(100svh - 340px))', md: 560 },
      minHeight: 400,
      border: '2px solid',
      borderColor: 'scene.text',
      borderRadius: '36px',
      bgcolor: 'background.paper',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      ...sx,
    }}
  >
    {children}
  </Box>
);

const WorkScreen = ({ t }) => (
  <Box data-screen="work" sx={{ position: 'absolute', inset: 0, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Box>
      <Typography sx={{ fontFamily: '"Lexend", sans-serif', fontWeight: 700, fontSize: 22 }}>
        {t('home.landing.focus.exercise')}
      </Typography>
      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
        {t('home.landing.focus.set_of', { n: 3, total: TOTAL_SETS })}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1.25 }}>
      {[1, 2, 3, 4].map((i) => (
        <Dot key={i} index={i} filled={i < 3} />
      ))}
    </Box>
    <Box sx={{ display: 'flex', gap: 1.25 }}>
      <Value label={t('home.landing.focus.weight')} value={`${formatNumber(72.5)} kg`} />
      <Value label={t('home.landing.focus.reps')} value="8" />
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mb: 0.5 }}>{t('home.landing.focus.sets_done')}</Typography>
      {[1, 2, 3].map((n) => (
        <Box key={n} data-new-set={n === 3 ? '' : undefined} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
          <Typography sx={{ fontSize: 16 }}>{t('focus.set_n', { n })}</Typography>
          <Typography sx={{ ...TABULAR, fontSize: 16, fontWeight: 700 }}>{`${formatNumber(72.5)} kg × 8`}</Typography>
        </Box>
      ))}
    </Box>
    <Box
      data-confirm
      sx={{
        bgcolor: 'primary.main',
        color: '#fff',
        borderRadius: '12px',
        py: 1.75,
        textAlign: 'center',
        fontWeight: 700,
        fontSize: 17,
      }}
    >
      {t('focus.confirm_set')}
    </Box>
  </Box>
);

const RestScreen = ({ t, live }) => {
  const r = (RING.size - RING.stroke) / 2;
  return (
    <Box
      data-screen="rest"
      sx={{ position: 'absolute', inset: 0, p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.08em', alignSelf: 'flex-start' }}>
        {t('focus.rest_caps')}
      </Typography>
      <Box sx={{ position: 'relative', width: RING.size, height: RING.size, mt: 1 }}>
        <svg width={RING.size} height={RING.size} viewBox={`0 0 ${RING.size} ${RING.size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={RING.size / 2} cy={RING.size / 2} r={r} fill="none" strokeWidth={RING.stroke} stroke="currentColor" opacity="0.12" />
          <Box
            component="circle"
            data-ring
            cx={RING.size / 2}
            cy={RING.size / 2}
            r={r}
            fill="none"
            strokeWidth={RING.stroke}
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={live ? 0 : 0.35}
            sx={{ stroke: (theme) => theme.palette.text.primary }}
          />
        </svg>
        <Typography
          data-clock
          sx={{ ...TABULAR, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 44 }}
        >
          {live ? clock(REST_SECONDS) : clock(58)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
        {t('focus.next_set', { n: 4, total: TOTAL_SETS })}
      </Typography>
      {live && (
        <Typography data-done sx={{ fontWeight: 700, fontSize: 17, mt: 'auto' }}>
          {t('home.landing.focus.done')}
        </Typography>
      )}
      <Box
        sx={{
          mt: live ? 0 : 'auto',
          alignSelf: 'stretch',
          border: '2px solid',
          borderColor: 'text.primary',
          borderRadius: '12px',
          py: 1.5,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 17,
        }}
      >
        {t('focus.skip_timer')}
      </Box>
    </Box>
  );
};

// Campo pieno da bordo a bordo: 100cqw è la larghezza della pagina (container-type sul Layout), senza scrollbar.
const FIELD = {
  isolation: 'isolate',
  bgcolor: 'scene.bg',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '100%',
    transform: 'translateX(-50%)',
    bgcolor: 'scene.bg',
    zIndex: -1,
    '@supports (width: 100cqw)': { width: '100cqw' },
  },
};

const Step = ({ id, t, live }) => (
  <Box data-step={id} sx={live ? { gridArea: '1 / 1' } : { mb: 3 }}>
    <Typography variant="h3" sx={{ fontSize: { xs: 22, md: 28 }, mb: 1 }}>
      {t(`home.landing.focus.${id}.title`)}
    </Typography>
    <Typography sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.5, maxWidth: 440, color: 'scene.muted' }}>
      {t(`home.landing.focus.${id}.text`)}
    </Typography>
  </Box>
);

const SceneFocus = () => {
  const { t } = useTranslation();
  const { ref, live } = useScrollScene(build);

  return (
    <Box ref={ref} component="section" aria-labelledby="scene-focus-title" sx={{ ...sceneSx(live, 1.5, 1.5), ...FIELD }}>
      <Box sx={stageSx(live)}>
        <Box
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: { xs: 2.5, md: 8 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ width: '100%', color: 'scene.text' }}>
            <Typography id="scene-focus-title" variant="h2" sx={{ fontSize: { xs: '1.75rem', md: '2.75rem' }, lineHeight: 1.1, mb: { xs: 2, md: 4 } }}>
              {t('home.landing.focus.title')}
            </Typography>
            <Box sx={live ? { display: 'grid' } : undefined}>
              {STEPS.map((id) => (
                <Step key={id} id={id} t={t} live={live} />
              ))}
            </Box>
          </Box>

          {live ? (
            <Phone sx={{ justifySelf: 'center' }}>
              <WorkScreen t={t} />
              <RestScreen t={t} live />
            </Phone>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Phone sx={{ height: 500 }}>
                <WorkScreen t={t} />
              </Phone>
              <Phone sx={{ height: 500 }}>
                <RestScreen t={t} live={false} />
              </Phone>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SceneFocus;

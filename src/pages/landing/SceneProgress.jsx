import { Box, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../i18n/format';
import { sceneSx, stageSx, useScrollScene } from './useScrollScene';

// Panca piana, una seduta a settimana: [peso, ripetizioni]. 1RM = peso × (1 + rip / 30), come workoutMetrics.js.
const SESSIONS = [[65, 6], [67.5, 6], [67.5, 8], [70, 8], [70, 9], [72.5, 8]];
const epley = (w, r) => w * (1 + r / 30);
const ONE_RM = SESSIONS.map(([w, r]) => epley(w, r));
const LABELLED = [0, 3, 5];
const Y_MIN = 74;
const Y_MAX = 96;
const X_PAD = 8;

const px = (i) => X_PAD + (i * (100 - 2 * X_PAD)) / (SESSIONS.length - 1);
const py = (v) => 100 - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * 100;
// Il grafico è 100 × 80 (rapporto 5/4): le y in percentuale diventano unità del viewBox con × 0,8.
const LINE = ONE_RM.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(2)} ${(py(v) * 0.8).toFixed(2)}`).join(' ');
const FIRST = ONE_RM[0];
const LAST = ONE_RM[ONE_RM.length - 1];
const fmt1 = (v) => formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TABULAR = { fontFamily: '"Inter", sans-serif', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };

const LINE_START = 0.06;
const LINE_SPAN = 0.62;

function build(tl, q) {
  const count = { v: FIRST };
  tl.fromTo(q('[data-line]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: LINE_SPAN }, LINE_START)
    .to(count, {
      v: LAST,
      duration: LINE_SPAN,
      onUpdate: () => {
        const el = q('[data-count]')[0];
        if (el) el.textContent = fmt1(count.v);
      },
    }, LINE_START);
  SESSIONS.forEach((_, i) => {
    const at = LINE_START + LINE_SPAN * ((px(i) - X_PAD) / (100 - 2 * X_PAD));
    tl.fromTo(q(`[data-point="${i}"]`), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.04 }, at);
  });
  tl.fromTo(q('[data-pr]'), { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.06, ease: 'back.out(2)' }, 0.76);
}

const SceneProgress = () => {
  const { t } = useTranslation();
  const { ref, live } = useScrollScene(build);

  return (
    <Box ref={ref} component="section" aria-labelledby="scene-progress-title" sx={sceneSx(live, 1.25, 1.25)}>
      <Box sx={stageSx(live)}>
        <Box
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
            gap: { xs: 3, md: 8 },
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography id="scene-progress-title" variant="h2" sx={{ fontSize: { xs: '1.75rem', md: '2.75rem' }, lineHeight: 1.1, mb: 2 }}>
              {t('home.landing.progress.title')}
            </Typography>
            <Typography sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.5, maxWidth: 460, mb: { xs: 2.5, md: 4 } }}>
              {t('home.landing.progress.text')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('home.landing.progress.label')}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ ...TABULAR, fontWeight: 800, fontSize: { xs: 48, md: 72 }, lineHeight: 1.1 }}>
                <span data-count>{fmt1(live ? FIRST : LAST)}</span>
                <Box component="span" sx={{ fontSize: { xs: 20, md: 28 }, fontWeight: 700, ml: 1 }}>kg</Box>
              </Typography>
              <Chip data-pr label={t('home.landing.progress.pr')} color="secondary" sx={{ fontSize: 16, fontWeight: 700, height: 36, borderRadius: '18px' }} />
            </Box>
          </Box>

          <Box aria-hidden="true" data-ui sx={{ position: 'relative', width: '100%', aspectRatio: '5 / 4' }}>
            <Box component="svg" viewBox="0 0 100 80" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <Box component="path" d={LINE} fill="none" strokeLinecap="round" strokeLinejoin="round" sx={{ stroke: (theme) => theme.palette.action.disabled, strokeWidth: 0.8 }} />
              <Box
                component="path"
                data-line
                d={LINE}
                pathLength="1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1"
                strokeDashoffset="0"
                sx={{ stroke: (theme) => theme.palette.text.primary, strokeWidth: 0.8 }}
              />
            </Box>
            {SESSIONS.map(([w, r], i) => (
              <Box
                key={i}
                data-point={i}
                sx={{ position: 'absolute', left: `${px(i)}%`, top: `${py(ONE_RM[i])}%`, width: 0, height: 0 }}
              >
                <Box sx={{ position: 'absolute', width: 16, height: 16, ml: '-8px', mt: '-8px', borderRadius: '50%', bgcolor: 'background.default', border: '3px solid', borderColor: 'text.primary' }} />
                {LABELLED.includes(i) && (
                  <Typography
                    sx={{ ...TABULAR, position: 'absolute', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 16, mt: '14px', transform: i === LABELLED[0] ? 'none' : 'translateX(-50%)', ml: i === LABELLED[0] ? '-8px' : 0 }}
                  >
                    {`${formatNumber(w)}×${r}`}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SceneProgress;

import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BlockShell from './BlockShell';
import { useBlockData } from './useBlockData';
import { readJson } from '../../../api/readJson';
import { intlLocale } from '../../../i18n/format';
import { PERIOD_UI, filterByPeriod, periodWeightDelta, sortByDate, weightTrend } from '../../../utils/bodyStatsPeriod';
import { BODY_LB_DIVISIONS, formatWeightInUnit } from '../../../utils/weightUnit';
import { TITLE_FONT_FAMILY } from '../../../utils/fonts';

const PERIOD = '1m';
const SPARK_POINTS = 30;

// Le misure con un peso, in ordine di data. Senza consenso alla salute il server risponde 200 con l'elenco vuoto
// (`consent_required`): non è un errore, è «nessuna misura».
const load = async () => {
  const data = await readJson('api/user_stats/read.php', (body) => Array.isArray(body?.records));
  if (!data) return null;
  return { weights: sortByDate(data.records.filter((row) => Number.isFinite(parseFloat(row.weight)))) };
};

// 'YYYY-MM-DD' → Date locale di quel giorno (mai l'orologio del dispositivo: «oggi» è la data del server), o null
const dayDate = (day) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof day === 'string' ? day : '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

// Linea dei pesi, decorativa: lo stesso dato è già scritto accanto
const Spark = ({ values, height, width }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = max === min ? 50 : 95 - ((value - min) / (max - min)) * 90;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return (
    <Box component="svg" aria-hidden focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none" sx={{ display: 'block', width, height, color: 'primary.text', flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </Box>
  );
};

// `today`: la data di oggi del server ('YYYY-MM-DD'); se manca vale l'ultima data delle misure
const BodyBlock = ({ today, weightUnit = 'kg', large = false }) => {
  const { t } = useTranslation();
  const { status, data } = useBlockData(load);
  const weights = data?.weights ?? [];
  const last = weights.at(-1) ?? null;
  const hasWeights = last !== null;

  const locale = intlLocale();
  const weightText = hasWeights ? formatWeightInUnit(last.weight, weightUnit, locale, { lbDivisions: BODY_LB_DIVISIONS }) : '';
  const deltaText = (() => {
    if (!hasWeights) return null;
    const delta = periodWeightDelta(filterByPeriod(weights, PERIOD, dayDate(today) ?? dayDate(last.date)));
    const trend = weightTrend(delta);
    if (trend === null) return null;
    if (trend === 'flat') return t(PERIOD_UI[PERIOD].stable);
    return t(PERIOD_UI[PERIOD].delta, { delta: formatWeightInUnit(delta, weightUnit, locale, { lbDivisions: BODY_LB_DIVISIONS, signed: true, maxDecimals: 1 }) });
  })();
  const values = weights.slice(-SPARK_POINTS).map((row) => parseFloat(row.weight));
  const spark = values.length >= 2;
  // Grande solo con almeno un peso: senza, resta la riga che invita ad aggiungere la prima misura
  const showLarge = large && hasWeights;
  const summary = hasWeights ? [weightText, deltaText].filter(Boolean).join(' · ') : t('home.block.body_empty');

  return (
    <BlockShell
      title={t('home.block.body_title')}
      to="/dashboard?tab=body"
      status={status}
      summary={summary}
      sign={spark ? <Spark values={values} width={56} height={24} /> : null}
      large={showLarge}
      contentRepeatsSummary
    >
      {hasWeights && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.2 }}>{weightText}</Typography>
            {deltaText && <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{deltaText}</Typography>}
          </Box>
          {spark && <Spark values={values} width="100%" height={96} />}
        </Box>
      )}
    </BlockShell>
  );
};

export default BodyBlock;

// PROTOTIPO volume, giro 2 (branch usa e getta, non va su main): dove sta la vista.
// ?variant=P1 scheda "Volume" · P2 scheda "Muscoli" (serie + recupero) · P3 sezione in cima a Progressi.
// Dati da workout_stats/dashboard.php → weekly_sets (forma inventata per il prototipo:
// { week: {muscolo: n}, previous_to_date: {...}, previous_total: n }) e recovery.
// Le varianti B e C del giro 1 sono nel commit precedente.
import { useEffect, useState } from 'react';
import { Box, Card, Typography, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { muscleLabel } from '../../i18n/labels';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import { readyInDays } from '../../utils/recoveryDay';

export const BODY_ORDER = [
  'petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome',
  'quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci',
];
export const VARIANT_NAMES = { P1: 'scheda Volume', P2: 'scheda Muscoli', P3: 'sezione in Progressi' };

const STATUS_COLOR = { PRONTO: 'recovery.ready', 'IN RECUPERO': 'recovery.recovering', AFFATICATO: 'recovery.fatigued' };

const rowsFrom = (sets, recovery) => BODY_ORDER.map((m) => ({
  muscle: m,
  week: sets?.week?.[m] || 0,
  prev: sets?.previous_to_date?.[m] || 0,
  status: recovery?.[m]?.status || null,
  days: recovery?.[m]?.ready_at ? readyInDays(recovery[m].ready_at) : null,
}));
const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);

const Delta = ({ now, prev, sx }) => {
  const d = now - prev;
  if (d === 0) return <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', ...sx }}>=</Typography>;
  return (
    <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: d > 0 ? 'success.main' : 'text.secondary', ...sx }}>
      {d > 0 ? `▲ ${d}` : `▼ ${-d}`}
    </Typography>
  );
};

// Q16: la variazione è contro la settimana scorsa allo stesso punto; il totale intero solo come riferimento
const Header = ({ rows, total }) => {
  const week = sum(rows, 'week');
  const prev = sum(rows, 'prev');
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 32, lineHeight: 1.1 }}>
        {week} <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>serie allenanti</Box>
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
        Settimana scorsa a quest&apos;ora {prev} <Delta now={week} prev={prev} sx={{ mx: 0.5 }} /> · intera {total}
      </Typography>
    </Box>
  );
};

const Bar = ({ value, max }) => (
  <Box sx={{ flex: 1, minWidth: 0, height: 8, borderRadius: '4px', bgcolor: 'divider', overflow: 'hidden' }}>
    <Box sx={{ height: '100%', width: `${(value / max) * 100}%`, bgcolor: 'primary.main', borderRadius: '4px' }} />
  </Box>
);

// Variante A del giro 1: una riga per muscolo con barra, numero e variazione.
export const VolumeCard = ({ rows, total }) => {
  const max = Math.max(1, ...rows.map((r) => r.week));
  return (
    <Card sx={{ p: '20px 22px' }}>
      <Header rows={rows} total={total} />
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {rows.map((r) => (
          <Box component="li" key={r.muscle} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, opacity: r.week ? 1 : 0.55 }}>
            <Typography noWrap sx={{ fontSize: 15, width: 104, flexShrink: 0 }}>{muscleLabel(r.muscle)}</Typography>
            <Bar value={r.week} max={max} />
            <Typography sx={{ width: 28, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.week}</Typography>
            <Box sx={{ width: 44, textAlign: 'right' }}><Delta now={r.week} prev={r.prev} /></Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

// P2: la stessa riga più lo stato di recupero (pallino colorato + scritta sotto la barra).
const recoveryText = (t, r) => {
  if (r.status === 'PRONTO') return t('recovery.ready');
  if (!r.status) return 'nessun dato';
  if (r.days === 0) return t('recovery.ready_today');
  if (r.days === 1) return t('recovery.ready_tomorrow');
  return t('recovery.ready_in_days', { count: r.days });
};

export const MusclesCard = ({ rows, total }) => {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.week));
  return (
    <Card sx={{ p: '20px 22px' }}>
      <Header rows={rows} total={total} />
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((r) => (
          <Box component="li" key={r.muscle}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: r.status ? STATUS_COLOR[r.status] : 'divider' }} />
              <Typography noWrap sx={{ fontSize: 15, flex: 1, color: r.week ? 'text.primary' : 'text.secondary' }}>{muscleLabel(r.muscle)}</Typography>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.week}</Typography>
              <Box sx={{ width: 44, textAlign: 'right' }}><Delta now={r.week} prev={r.prev} /></Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75, pl: 2.25 }}>
              <Bar value={r.week} max={max} />
              <Typography noWrap sx={{ width: 120, textAlign: 'right', fontSize: 13, fontWeight: r.status === 'PRONTO' ? 600 : 400, color: r.status === 'PRONTO' ? 'recovery.ready' : 'text.secondary' }}>
                {recoveryText(t, r)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

const VolumeView = ({ kind }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}api/workout_stats/dashboard.php`, { credentials: 'include' })
      .then((r) => r.json()).then(setData).catch(() => setData({}));
  }, []);
  if (!data) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>;
  const rows = rowsFrom(data.weekly_sets, data.recovery);
  const total = data.weekly_sets?.previous_total ?? 0;
  return kind === 'muscles' ? <MusclesCard rows={rows} total={total} /> : <VolumeCard rows={rows} total={total} />;
};

export default VolumeView;

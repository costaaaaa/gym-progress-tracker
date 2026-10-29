// PROTOTIPO volume (branch usa e getta, non va su main): tre varianti della vista "Volume"
// nel hub Progressi, con ?variant=A|B|C. Dati da workout_stats/dashboard.php → weekly_sets
// (forma inventata per il prototipo: { week: {muscolo: n}, previous: {muscolo: n} }).
import { useEffect, useState } from 'react';
import { Box, Card, Typography, CircularProgress } from '@mui/material';
import { API_BASE_URL } from '../../config';
import { muscleLabel } from '../../i18n/labels';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';

// Ordine del corpo, come nel recupero, con adduttori e abduttori
export const BODY_ORDER = [
  'petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome',
  'quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci',
];
const AREAS = [
  { label: 'Parte alta', muscles: ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti'] },
  { label: 'Core', muscles: ['addome'] },
  { label: 'Parte bassa', muscles: ['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci'] },
];

const rowsFrom = (data) => BODY_ORDER.map((m) => ({
  muscle: m, week: data?.week?.[m] || 0, prev: data?.previous?.[m] || 0,
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

const Header = ({ rows }) => {
  const week = sum(rows, 'week');
  const prev = sum(rows, 'prev');
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 32, lineHeight: 1.1 }}>
        {week} <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>serie allenanti</Box>
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
        Questa settimana (lun–dom) · la settimana scorsa {prev} <Delta now={week} prev={prev} sx={{ ml: 0.5 }} />
      </Typography>
    </Box>
  );
};

// A — Elenco: una riga per muscolo, barra proporzionale al muscolo più allenato, numero e variazione.
const VariantA = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.week));
  return (
    <Card sx={{ p: '20px 22px' }}>
      <Header rows={rows} />
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {rows.map((r) => (
          <Box component="li" key={r.muscle} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, opacity: r.week ? 1 : 0.55 }}>
            <Typography noWrap sx={{ fontSize: 15, width: 104, flexShrink: 0 }}>{muscleLabel(r.muscle)}</Typography>
            <Box sx={{ flex: 1, height: 8, borderRadius: '4px', bgcolor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${(r.week / max) * 100}%`, bgcolor: 'primary.main', borderRadius: '4px' }} />
            </Box>
            <Typography sx={{ width: 28, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.week}</Typography>
            <Box sx={{ width: 44, textAlign: 'right' }}><Delta now={r.week} prev={r.prev} /></Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

// B — Tessere raggruppate per area: numero grande, la settimana scorsa sotto.
const VariantB = ({ rows }) => {
  const byMuscle = Object.fromEntries(rows.map((r) => [r.muscle, r]));
  return (
    <Box>
      <Card sx={{ p: '20px 22px', mb: 2 }}><Header rows={rows} /></Card>
      {AREAS.map((area) => (
        <Box key={area.label} sx={{ mb: 2.5 }}>
          <Typography variant="cardTitle" sx={{ mb: 1, display: 'block' }}>{area.label}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: 1.5 }}>
            {area.muscles.map((m) => {
              const r = byMuscle[m];
              return (
                <Card key={m} sx={{ p: '14px 16px', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{muscleLabel(m)}</Typography>
                  <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 28, lineHeight: 1.2, color: r.week ? 'text.primary' : 'text.disabled' }}>
                    {r.week}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    sett. scorsa {r.prev} <Delta now={r.week} prev={r.prev} sx={{ ml: 0.5 }} />
                  </Typography>
                </Card>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// C — Confronto: due barre per muscolo (questa settimana piena, la scorsa vuota) sulla stessa scala;
// i muscoli a zero in tutte e due le settimane finiscono in una riga in fondo.
const VariantC = ({ rows }) => {
  const shown = rows.filter((r) => r.week || r.prev);
  const idle = rows.filter((r) => !r.week && !r.prev);
  const max = Math.max(1, ...shown.flatMap((r) => [r.week, r.prev]));
  return (
    <Card sx={{ p: '20px 22px' }}>
      <Header rows={rows} />
      <Box sx={{ display: 'flex', gap: 2, mb: 2, fontSize: 13, color: 'text.secondary' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 14, height: 8, borderRadius: '2px', bgcolor: 'primary.main' }} />Questa settimana</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 14, height: 8, borderRadius: '2px', border: '1.5px solid', borderColor: 'text.secondary' }} />Settimana scorsa</Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {shown.map((r) => (
          <Box key={r.muscle}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 15 }}>{muscleLabel(r.muscle)}</Typography>
              <Typography sx={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                <b>{r.week}</b> <Box component="span" sx={{ color: 'text.secondary' }}>/ {r.prev}</Box>
              </Typography>
            </Box>
            <Box sx={{ height: 8, width: `${(r.week / max) * 100}%`, minWidth: r.week ? 4 : 0, bgcolor: 'primary.main', borderRadius: '2px', mb: 0.5 }} />
            <Box sx={{ height: 8, width: `${(r.prev / max) * 100}%`, minWidth: r.prev ? 4 : 0, border: '1.5px solid', borderColor: 'text.secondary', borderRadius: '2px', boxSizing: 'border-box' }} />
          </Box>
        ))}
      </Box>
      {idle.length > 0 && (
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 2.5 }}>
          Non allenati nelle ultime due settimane: {idle.map((r) => muscleLabel(r.muscle)).join(', ')}
        </Typography>
      )}
    </Card>
  );
};

export const VARIANT_NAMES = { A: 'Elenco con barre', B: 'Tessere per area', C: 'Confronto settimane' };
const VARIANTS = { A: VariantA, B: VariantB, C: VariantC };

const VolumeView = ({ variant }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}api/workout_stats/dashboard.php`, { credentials: 'include' })
      .then((r) => r.json()).then((d) => setData(d.weekly_sets || {})).catch(() => setData({}));
  }, []);
  if (!data) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>;
  const V = VARIANTS[variant];
  return <V rows={rowsFrom(data)} />;
};

export default VolumeView;

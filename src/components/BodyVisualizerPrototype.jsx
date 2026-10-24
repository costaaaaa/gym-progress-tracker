// PROTOTIPO USA-E-GETTA (issue mobile #28): varianti della card "Stato muscolare". Non va in main.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { muscleLabel } from '../i18n/labels';
import { readyInDays } from '../utils/recoveryDay';

export const VARIANTS = [
  { key: 'A', label: 'A (Attuale)' },
  { key: 'B', label: 'B (Griglia 2 colonne)' },
  { key: 'C', label: 'C (Per stato)' },
  { key: 'D', label: 'D (Righe a barra)' },
];

const GROUPS = ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'polpacci'];

const META = {
  PRONTO: { label: 'recovery.ready', color: 'recovery.ready' },
  'IN RECUPERO': { label: 'recovery.recovering', color: 'recovery.recovering' },
  AFFATICATO: { label: 'recovery.fatigued', color: 'recovery.fatigued' },
};

const readyLabel = (t, days) => {
  if (days === 0) return t('recovery.ready_today');
  if (days === 1) return t('recovery.ready_tomorrow');
  return t('recovery.ready_in_days_other', { count: days });
};

const shortDay = (days) => (days === 0 ? 'oggi' : days === 1 ? 'domani' : `tra ${days} giorni`);

const read = (data, group) => {
  const info = data?.[group];
  const meta = META[info?.status];
  const days = info?.status === 'PRONTO' ? null : readyInDays(info?.ready_at);
  const percent = typeof info?.percent === 'number' ? Math.max(0, Math.min(100, info.percent)) : null;
  return { group, meta, status: info?.status, days, percent };
};

const Bar = ({ percent, color, height = 5 }) => (
  <Box sx={{ height, borderRadius: '3px', bgcolor: 'divider', overflow: 'hidden' }}>
    <Box sx={{ height: '100%', width: `${percent}%`, bgcolor: color, borderRadius: '3px' }} />
  </Box>
);

const NAME = { fontSize: 15, color: 'text.primary' };
const SECOND = { fontSize: 13, color: 'text.secondary' };

// ---- Hook + barra flottante ----
const currentKey = () => {
  const v = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return VARIANTS.some((x) => x.key === v) ? v : 'A';
};

export function useVariant() {
  const [key, setKey] = useState(currentKey);
  useEffect(() => {
    const on = () => setKey(currentKey());
    window.addEventListener('proto-variant', on);
    return () => window.removeEventListener('proto-variant', on);
  }, []);
  return key;
}

export function VariantBar() {
  const key = useVariant();
  const idx = VARIANTS.findIndex((v) => v.key === key);
  const go = (delta) => {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length].key;
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event('proto-variant'));
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const btn = { all: 'unset', cursor: 'pointer', padding: '4px 12px', fontSize: 18 };
  return createPortal(
    <div
      data-proto-bar
      style={{
        position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: 4, background: '#111', color: '#fff',
        borderRadius: 999, padding: '4px 8px', fontSize: 14, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.4)',
      }}
    >
      <button type="button" style={btn} onClick={() => go(-1)} aria-label="Precedente">←</button>
      <span>{VARIANTS[idx].label}</span>
      <button type="button" style={btn} onClick={() => go(1)} aria-label="Successiva">→</button>
    </div>,
    document.body,
  );
}

// ---- B: griglia 2 colonne ----
export function VariantB({ data }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 2 }}>
      {GROUPS.map((g) => {
        const r = read(data, g);
        return (
          <Box key={g} sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
              <Typography sx={{ ...NAME, minWidth: 0 }}>{muscleLabel(g)}</Typography>
              <Typography data-proto-status sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: r.meta ? r.meta.color : 'text.disabled' }}>
                {r.meta ? t(r.meta.label) : t('recovery.no_data')}
              </Typography>
            </Box>
            {r.meta && r.percent !== null && <Box sx={{ mt: 0.75 }}><Bar percent={r.percent} color={r.meta.color} /></Box>}
            {r.days !== null && <Typography sx={{ ...SECOND, mt: 0.5 }}>{readyLabel(t, r.days)}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

// ---- C: per stato ----
const FullRow = ({ r }) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={NAME}>{muscleLabel(r.group)}</Typography>
        {r.days !== null && <Typography sx={SECOND}>{readyLabel(t, r.days)}</Typography>}
      </Box>
      {r.percent !== null && <Box sx={{ mt: 0.75 }}><Bar percent={r.percent} color={r.meta.color} /></Box>}
    </Box>
  );
};

export function VariantC({ data }) {
  const { t } = useTranslation();
  const rows = GROUPS.map((g) => read(data, g));
  const byDays = (a, b) => (a.days ?? 0) - (b.days ?? 0);
  const fatigued = rows.filter((r) => r.status === 'AFFATICATO').sort(byDays);
  const recovering = rows.filter((r) => r.status === 'IN RECUPERO').sort(byDays);
  const ready = rows.filter((r) => r.status === 'PRONTO');
  const none = rows.filter((r) => !r.meta);
  const Head = ({ meta, count }) => (
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: meta.color, mb: 1 }}>{t(meta.label)} · {count}</Typography>
  );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {fatigued.length > 0 && (
        <Box>
          <Head meta={META.AFFATICATO} count={fatigued.length} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{fatigued.map((r) => <FullRow key={r.group} r={r} />)}</Box>
        </Box>
      )}
      {recovering.length > 0 && (
        <Box>
          <Head meta={META['IN RECUPERO']} count={recovering.length} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{recovering.map((r) => <FullRow key={r.group} r={r} />)}</Box>
        </Box>
      )}
      {ready.length > 0 && (
        <Box>
          <Head meta={META.PRONTO} count={ready.length} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {ready.map((r) => (
              <Box key={r.group} sx={{ fontSize: 15, color: 'text.primary', border: 1, borderColor: 'divider', borderRadius: '999px', px: 1.5, py: 0.25 }}>
                {muscleLabel(r.group)}
              </Box>
            ))}
          </Box>
        </Box>
      )}
      {none.length > 0 && (
        <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>
          {t('recovery.no_data')}: {none.map((r) => muscleLabel(r.group)).join(', ')}
        </Typography>
      )}
    </Box>
  );
}

// ---- D: righe a barra ----
export function VariantD({ data }) {
  const { t } = useTranslation();
  const rank = (r) => (!r.meta ? 99 : r.status === 'PRONTO' ? -1 : r.days ?? 0);
  const rows = GROUPS.map((g) => read(data, g)).sort((a, b) => rank(a) - rank(b));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {rows.map((r) => (
        <Box key={r.group} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography noWrap sx={{ ...NAME, width: 104, flexShrink: 0 }}>{muscleLabel(r.group)}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {r.meta && r.percent !== null ? <Bar percent={r.percent} color={r.meta.color} height={6} /> : <Bar percent={0} color="divider" height={6} />}
          </Box>
          <Typography
            noWrap
            sx={{
              width: 92, flexShrink: 0, textAlign: 'right', fontSize: 13,
              fontWeight: r.status === 'PRONTO' ? 600 : 400,
              color: r.status === 'PRONTO' ? r.meta.color : r.meta ? 'text.secondary' : 'text.disabled',
            }}
          >
            {r.status === 'PRONTO' ? t('recovery.ready') : r.meta && r.days !== null ? shortDay(r.days) : '—'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

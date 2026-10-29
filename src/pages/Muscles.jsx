import { useEffect, useState } from 'react';
import { Alert, Box, Card, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { muscleLabel } from '../i18n/labels';
import { MUSCLE_GROUPS } from '../utils/recoveryGroups';
import { readyInDays } from '../utils/recoveryDay';
import { STATUS_COLOR, readyLabel } from '../utils/recoveryStatus';
import { TITLE_FONT_FAMILY } from '../utils/fonts';

// Variazione contro la settimana scorsa allo stesso punto: ▲ in verde, ▼ e = in grigio (come il
// delta di ChartCard). Condivisa dall'intestazione (totali) e da ogni riga (per muscolo).
const Delta = ({ value }) => {
  if (value === 0) return <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>=</Typography>;
  return (
    <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: value > 0 ? 'success.main' : 'text.secondary' }}>
      {value > 0 ? `▲ ${value}` : `▼ ${-value}`}
    </Typography>
  );
};

// Totale della settimana + confronto con la settimana scorsa allo stesso punto (intera solo come riferimento).
const Header = ({ weekTotal, prevToDateTotal, prevTotal }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 800, fontSize: 32, lineHeight: 1.1 }}>
        {weekTotal} <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>{t('muscles.header.sets_label')}</Box>
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.5 }}>
        {t('muscles.header.previous_at', { count: prevToDateTotal })} <Delta value={weekTotal - prevToDateTotal} /> · {t('muscles.header.previous_total', { count: prevTotal })}
      </Typography>
    </Box>
  );
};

// Barra proporzionale al muscolo più allenato della settimana; vuota (0) se il muscolo non ha serie.
const Bar = ({ value, max, label }) => (
  <Box
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value}
    sx={{ flex: 1, minWidth: 0, height: 8, borderRadius: '4px', bgcolor: 'divider', overflow: 'hidden' }}
  >
    <Box sx={{ height: '100%', width: `${max ? (value / max) * 100 : 0}%`, bgcolor: 'primary.main', borderRadius: '4px' }} />
  </Box>
);

// Testo di recupero di una riga: "Pronto" o il conto alla rovescia già usato in BodyVisualizer;
// "nessun dato" se il backend non ha (ancora) un recupero per questo muscolo.
const recoveryText = (t, status, days) => {
  if (status === 'PRONTO') return t('recovery.ready');
  if (!status) return t('muscles.row.no_data');
  return readyLabel(t, days);
};

const MuscleRow = ({ muscle, week, prev, status, days, max }) => {
  const { t } = useTranslation();
  const trained = week > 0;
  return (
    <Box component="li">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: status ? STATUS_COLOR[status] : 'divider' }} />
        <Typography noWrap sx={{ fontSize: 15, flex: 1, color: trained ? 'text.primary' : 'text.secondary' }}>
          {muscleLabel(muscle)}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{week}</Typography>
        <Box sx={{ width: 44, textAlign: 'right' }}><Delta value={week - prev} /></Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75, pl: 2.25 }}>
        <Bar value={week} max={max} label={muscleLabel(muscle)} />
        <Typography
          noWrap
          sx={{
            width: 120,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: status === 'PRONTO' ? 600 : 400,
            color: status === 'PRONTO' ? 'recovery.ready' : 'text.secondary',
          }}
        >
          {recoveryText(t, status, days)}
        </Typography>
      </Box>
    </Box>
  );
};

const Muscles = () => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}api/workout_stats/dashboard.php`, { credentials: 'include' });
        const body = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (body?.success) setData(body);
        else setError(t('muscles.load_error'));
      } catch {
        if (!cancelled) setError(t('muscles.load_error'));
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const sets = data.weekly_sets || { week: {}, previous_to_date: {}, previous_total: 0 };
  const weekTotal = MUSCLE_GROUPS.reduce((sum, m) => sum + (sets.week?.[m] || 0), 0);
  const prevToDateTotal = MUSCLE_GROUPS.reduce((sum, m) => sum + (sets.previous_to_date?.[m] || 0), 0);
  const max = Math.max(1, ...MUSCLE_GROUPS.map((m) => sets.week?.[m] || 0));

  return (
    <Card sx={{ p: '20px 22px', maxWidth: 720 }}>
      <Header weekTotal={weekTotal} prevToDateTotal={prevToDateTotal} prevTotal={sets.previous_total || 0} />
      <Box component="ul" aria-label={t('dashboard.tab.muscles')} sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MUSCLE_GROUPS.map((muscle) => {
          const week = sets.week?.[muscle] || 0;
          const prev = sets.previous_to_date?.[muscle] || 0;
          const recovery = data.recovery?.[muscle];
          const status = recovery?.status || null;
          const days = recovery?.ready_at ? readyInDays(recovery.ready_at) : null;
          return <MuscleRow key={muscle} muscle={muscle} week={week} prev={prev} status={status} days={days} max={max} />;
        })}
      </Box>
    </Card>
  );
};

export default Muscles;

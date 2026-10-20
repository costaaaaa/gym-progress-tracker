// PROTOTIPO USA E GETTA (tracker #18, selettore periodo + paginazione storico).
// Rotta di sviluppo /prototipo-misure, dati finti in memoria (nessun fetch, nessun login).
// Parametri: ?variant=S1..S3-T1..T3  &data=old (ultima misura di 5 mesi fa)  &embedded=1  &bar=0
// Fork di BodyStats.jsx: tenere le modifiche qui, non toccare BodyStats.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Typography, Grid, Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Button, IconButton, ToggleButton, ToggleButtonGroup, Chip, TablePagination, Tabs, Tab,
  ButtonBase,
} from '@mui/material';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FavoriteIcon from '@mui/icons-material/Favorite';
import BarChartIcon from '@mui/icons-material/BarChart';
import StraightenIcon from '@mui/icons-material/Straighten';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import ChartCard from '../components/ChartCard';
import PrototypeSwitcher, { parseVariant } from '../components/PrototypeSwitcher';
import { useThemeMode } from '../context/ThemeModeContext';
import { formatDate, formatNumber } from '../i18n/format';
import { buildRows, addMonths, toIso } from './bodyStatsPrototypeData';

const PERIODS = [
  { key: '1M', months: 1, delta: "nell'ultimo mese" },
  { key: '3M', months: 3, delta: 'negli ultimi 3 mesi' },
  { key: '6M', months: 6, delta: 'negli ultimi 6 mesi' },
  { key: '1A', months: 12, delta: "nell'ultimo anno" },
  { key: 'ALL', months: null, delta: 'dalla prima rilevazione', label: 'Tutto' },
];
const periodLabel = (p) => p.label || p.key;

const StatValue = ({ row, field }) => {
  if (!row[field]) return '-';
  const fromHealth = (row.health_fields || '').split(',').includes(field);
  return (
    <>
      {row[field]}
      {fromHealth && (
        <Box component="span" title="Da Apple Salute / Health Connect" sx={{ ml: 0.5, verticalAlign: 'middle' }}>
          <FavoriteIcon sx={{ fontSize: 11, color: '#ff2d55' }} />
        </Box>
      )}
    </>
  );
};

const BODY_COMPOSITION_SERIES = [
  { key: 'body_fat_percentage', label: 'Grasso', color: '#4f46e5', unit: '%' },
  { key: 'muscle_mass_percentage', label: 'Muscolo', color: '#16a34a', unit: '%' },
];
const CIRCUMFERENCE_SERIES = [
  { key: 'chest_size', label: 'Torace', color: '#d50000', unit: 'cm' },
  { key: 'waist_size', label: 'Vita', color: '#d97706', unit: 'cm' },
  { key: 'arm_size', label: 'Braccio', color: '#4f46e5', unit: 'cm' },
  { key: 'leg_size', label: 'Gamba', color: '#7c3aed', unit: 'cm' },
];

const has = (v) => v !== null && v !== undefined && v !== '';
const lastValueOf = (data, key) => {
  for (let i = data.length - 1; i >= 0; i--) if (has(data[i][key])) return data[i][key];
  return null;
};

const MiniMultiLineChart = ({ data, series }) => (
  <Box sx={{ height: 90 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false}
            connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </Box>
);

const MiniChartLegend = ({ data, series }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.5 }}>
    {series.map((s) => {
      const value = lastValueOf(data, s.key);
      return (
        <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {s.label}: <strong>{value !== null ? `${value}${s.unit}` : '—'}</strong>
          </Typography>
        </Box>
      );
    })}
  </Box>
);

/* ---------- Selettori di periodo ---------- */

const PeriodToggle = ({ value, onChange, fullWidth }) => (
  <ToggleButtonGroup
    size="small" exclusive fullWidth={fullWidth} value={value} aria-label="Periodo"
    onChange={(_, v) => v && onChange(v)}
    sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: fullWidth ? 1 : 1.5 } }}
  >
    {PERIODS.map((p) => (
      <ToggleButton key={p.key} value={p.key}>{periodLabel(p)}</ToggleButton>
    ))}
  </ToggleButtonGroup>
);

// Stile da app mobile: pillola piena rossa se selezionata, contorno altrimenti.
const PeriodChips = ({ value, onChange }) => (
  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} role="group" aria-label="Periodo">
    {PERIODS.map((p) => {
      const selected = p.key === value;
      return (
        <Chip
          key={p.key}
          label={periodLabel(p)}
          clickable
          color="primary"
          variant={selected ? 'filled' : 'outlined'}
          onClick={() => onChange(p.key)}
          aria-pressed={selected}
          sx={{
            fontWeight: 700, fontSize: 13, height: 32, borderRadius: 999, px: 0.5,
            ...(!selected && { borderColor: 'divider', color: 'text.primary' }),
          }}
        />
      );
    })}
  </Box>
);

/* ---------- Tabella storico ---------- */

const headSx = { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' };

const HistoryTable = ({ rows, onDelete }) => (
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell sx={headSx}>Data</TableCell>
        <TableCell align="right" sx={headSx}>Peso</TableCell>
        <TableCell align="right" sx={headSx}>Grasso %</TableCell>
        <TableCell align="right" sx={headSx}>Muscolo %</TableCell>
        <TableCell align="right" sx={headSx}>Torace</TableCell>
        <TableCell align="right" sx={headSx}>Braccio</TableCell>
        <TableCell align="right" sx={headSx}>Vita</TableCell>
        <TableCell align="right" sx={headSx}>Gamba</TableCell>
        <TableCell align="center" sx={headSx}>Azioni</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id}>
          <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(row.date)}</TableCell>
          <TableCell align="right" sx={{ fontSize: 13, fontWeight: 700 }}><StatValue row={row} field="weight" /></TableCell>
          <TableCell align="right" sx={{ fontSize: 13 }}><StatValue row={row} field="body_fat_percentage" /></TableCell>
          <TableCell align="right" sx={{ fontSize: 13 }}>{row.muscle_mass_percentage || '-'}</TableCell>
          <TableCell align="right" sx={{ fontSize: 13 }}>{row.chest_size || '-'}</TableCell>
          <TableCell align="right" sx={{ fontSize: 13 }}>{row.arm_size || '-'}</TableCell>
          <TableCell align="right" sx={{ fontSize: 13 }}><StatValue row={row} field="waist_size" /></TableCell>
          <TableCell align="right" sx={{ fontSize: 13 }}>{row.leg_size || '-'}</TableCell>
          <TableCell align="center">
            <IconButton size="small" color="error" onClick={() => onDelete(row.id)} aria-label="Elimina">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </TableCell>
        </TableRow>
      ))}
      {rows.length === 0 && (
        <TableRow>
          <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>Nessuna misurazione registrata</TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
);

const FooterBar = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
    {children}
  </Box>
);

// T1: i primi 10, poi "Mostra altre 20 (ne restano N)"
const TableBlocks = ({ allDesc, onDelete }) => {
  const [visible, setVisible] = useState(10);
  const remaining = Math.max(allDesc.length - visible, 0);
  return (
    <>
      <HistoryTable rows={allDesc.slice(0, visible)} onDelete={onDelete} />
      {remaining > 0 && (
        <FooterBar>
          <Button size="small" onClick={() => setVisible((v) => v + 20)}>
            Mostra altre {Math.min(20, remaining)} (ne restano {remaining})
          </Button>
        </FooterBar>
      )}
    </>
  );
};

// T2: 10 righe per pagina, "‹ Precedenti  1–10 di 312  Successive ›"
const TablePager = ({ allDesc, onDelete }) => {
  const [page, setPage] = useState(0);
  const size = 10;
  const total = allDesc.length;
  const lastPage = Math.max(Math.ceil(total / size) - 1, 0);
  const p = Math.min(page, lastPage);
  const from = total === 0 ? 0 : p * size + 1;
  const to = Math.min((p + 1) * size, total);
  return (
    <>
      <HistoryTable rows={allDesc.slice(p * size, p * size + size)} onDelete={onDelete} />
      <FooterBar>
        <Button size="small" disabled={p === 0} onClick={() => setPage(p - 1)}>‹ Precedenti</Button>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {from}–{to} di {total}
        </Typography>
        <Button size="small" disabled={p === lastPage} onClick={() => setPage(p + 1)}>Successive ›</Button>
      </FooterBar>
    </>
  );
};

// T3: TablePagination MUI con righe per pagina 10/25/50
const TableMui = ({ allDesc, onDelete }) => {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const lastPage = Math.max(Math.ceil(allDesc.length / size) - 1, 0);
  const p = Math.min(page, lastPage);
  return (
    <>
      <HistoryTable rows={allDesc.slice(p * size, p * size + size)} onDelete={onDelete} />
      <TablePagination
        component="div"
        count={allDesc.length}
        page={p}
        onPageChange={(_, n) => setPage(n)}
        rowsPerPage={size}
        onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Righe per pagina:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} di ${count}`}
        getItemAriaLabel={(type) => (type === 'next' ? 'Pagina successiva' : 'Pagina precedente')}
      />
    </>
  );
};

/* ---------- Pagina ---------- */

const BodyStatsView = ({ isEmbedded, variant, dataMode }) => {
  const [selVariant, tabVariant] = variant.split('-');
  const [stats, setStats] = useState(() => buildRows(dataMode));
  const [periodKey, setPeriodKey] = useState('3M');
  const period = PERIODS.find((p) => p.key === periodKey);

  const onDelete = (id) => setStats((rows) => rows.filter((r) => r.id !== id));

  const allDesc = useMemo(() => stats.slice().reverse(), [stats]);

  // Righe del periodo: da oggi - N mesi di calendario, giorno di inizio incluso (stringhe YYYY-MM-DD)
  const periodRows = useMemo(() => {
    if (period.months === null) return stats;
    const start = toIso(addMonths(new Date(), -period.months));
    return stats.filter((r) => r.date >= start);
  }, [stats, period]);

  const chartData = periodRows.map((item) => ({ ...item, dateFormatted: formatDate(item.date, { day: '2-digit', month: '2-digit' }) }));
  const weightSeries = chartData.map((d) => d.weight).filter(has).map(Number);
  const lastWeight = weightSeries.length ? weightSeries[weightSeries.length - 1] : null;
  const weightDelta = weightSeries.length >= 2 ? lastWeight - weightSeries[0] : null;
  const fmt = (n) => formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const latest = stats[stats.length - 1];

  const selector = selVariant === 'S3'
    ? <PeriodChips value={periodKey} onChange={setPeriodKey} />
    : <PeriodToggle value={periodKey} onChange={setPeriodKey} fullWidth={selVariant === 'S2'} />;

  const table = {
    T1: <TableBlocks allDesc={allDesc} onDelete={onDelete} />,
    T2: <TablePager allDesc={allDesc} onDelete={onDelete} />,
    T3: <TableMui allDesc={allDesc} onDelete={onDelete} />,
  }[tabVariant];

  const newButton = (
    <Button variant="contained" startIcon={<AddIcon />}>Nuova Misurazione</Button>
  );

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        {!isEmbedded && (
          <Typography variant="h4" sx={{ fontWeight: 800, mr: 'auto' }}>Statistiche Fisiche</Typography>
        )}
        {selVariant === 'S1' && selector}
        {newButton}
      </Box>

      {selVariant !== 'S1' && <Box sx={{ mb: 3 }}>{selector}</Box>}

      <Grid container spacing={3}>
        {periodRows.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ p: '28px 22px', textAlign: 'center' }}>
              <EventBusyIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Nessuna misura nel periodo</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
                Ultima rilevazione il {formatDate(latest.date)}: {has(latest.weight) ? `${latest.weight} kg` : '—'}
              </Typography>
            </Card>
          </Grid>
        ) : (
          <>
            <Grid item xs={12}>
              <ChartCard
                title="Andamento Peso (kg)"
                data={weightSeries}
                color="primary.main"
                valueLabel={lastWeight !== null ? `${fmt(lastWeight)} kg` : '—'}
                deltaUp={weightDelta !== null ? weightDelta >= 0 : true}
                deltaText={weightDelta !== null ? `${weightDelta >= 0 ? '+' : ''}${fmt(weightDelta)} kg ${period.delta}` : undefined}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: '22px' }}>
                <Typography sx={{ textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                  Composizione Corporea (%)
                </Typography>
                <MiniMultiLineChart data={chartData} series={BODY_COMPOSITION_SERIES} />
                <MiniChartLegend data={chartData} series={BODY_COMPOSITION_SERIES} />
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: '22px' }}>
                <Typography sx={{ textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                  Circonferenze (cm)
                </Typography>
                <MiniMultiLineChart data={chartData} series={CIRCUMFERENCE_SERIES} />
                <MiniChartLegend data={chartData} series={CIRCUMFERENCE_SERIES} />
              </Card>
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <TableContainer component={Card} sx={{ p: 0 }}>{table}</TableContainer>
        </Grid>
      </Grid>
    </>
  );
};

const BodyStatsPrototype = () => {
  const [params, setParams] = useSearchParams();
  const { mode, toggleThemeMode } = useThemeMode();
  const variant = parseVariant(params.get('variant'));
  const dataMode = params.get('data') === 'old' ? 'old' : 'recent';
  const embedded = params.get('embedded') === '1';
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  const view = <BodyStatsView key={dataMode} isEmbedded={embedded} variant={variant} dataMode={dataMode} />;

  return (
    <>
      {embedded ? (
        // Come Dashboard.jsx: barra a tab + BodyStats incorporato (senza titolo, senza Container)
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Tabs value={1} aria-label="dashboard hub tabs" TabIndicatorProps={{ sx: { height: 2, bgcolor: 'primary.main' } }}
              sx={{ minHeight: 0, '& .MuiTab-root': { textTransform: 'none', fontSize: 14, fontWeight: 500, minHeight: 44, color: 'text.secondary', '&.Mui-selected': { color: 'primary.main', fontWeight: 600 } } }}>
              <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Progressi Workout" />
              <Tab icon={<StraightenIcon fontSize="small" />} iconPosition="start" label="Misure Corporee" />
            </Tabs>
          </Box>
          <Box sx={{ mt: 2 }}>{view}</Box>
        </Box>
      ) : (
        <Container maxWidth="lg" disableGutters sx={{ mt: 0 }}>{view}</Container>
      )}
      <Box sx={{ height: 150 }} />
      <PrototypeSwitcher current={variant}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            [dataMode === 'old' ? 'dati: vecchi' : 'dati: recenti', () => set('data', dataMode === 'old' ? null : 'old')],
            [embedded ? 'in Dashboard' : 'pagina intera', () => set('embedded', embedded ? null : '1')],
            [mode === 'dark' ? 'tema: scuro' : 'tema: chiaro', toggleThemeMode],
          ].map(([label, fn]) => (
            <ButtonBase key={label} onClick={fn} sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: 12, color: '#fff', border: '1px dashed rgba(255,255,255,.45)' }}>
              {label}
            </ButtonBase>
          ))}
        </Box>
      </PrototypeSwitcher>
    </>
  );
};

export default BodyStatsPrototype;

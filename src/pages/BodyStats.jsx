import { Fragment, useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Card,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  IconButton,
  Chip,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { API_BASE_URL } from '../config';
import { DatePicker } from '@mui/x-date-pickers';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import DateLocalization from '../i18n/DateLocalization';
import { formatDate, formatNumber } from '../i18n/format';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import ChartCard, { buildPoints } from '../components/ChartCard';
import { dayNumber } from '../utils/calendarDay';
import HealthConsentCard from '../components/HealthConsentCard';
import HealthAppHint from '../components/HealthAppHint';
import { DEFAULT_PERIOD, PERIODS, PERIOD_UI, filterByPeriod, periodStart, periodWeightDelta, weightTrend, sortByDate, paginate } from '../utils/bodyStatsPeriod';

// Cuore accanto a un valore arrivato da Apple Salute / Health Connect
// (health_fields è l'elenco dei campi importati, separati da virgola).
const isFromHealth = (row, field) => (row.health_fields || '').split(',').includes(field);

const HealthMark = () => {
  const { t } = useTranslation();
  return (
    <Box component="span" title={t('body.from_health')} sx={{ ml: 0.5, verticalAlign: 'middle' }}>
      <FavoriteIcon sx={{ fontSize: 11, color: '#ff2d55' }} />
    </Box>
  );
};

const StatValue = ({ row, field }) => {
  if (!row[field]) return '-';
  return (
    <>
      {row[field]}
      {isFromHealth(row, field) && <HealthMark />}
    </>
  );
};

// Misure della card "Composizione corporea" e "Circonferenze": chiave dato, etichetta, unità.
const BODY_COMPOSITION_SERIES = [
  { key: 'body_fat_percentage', label: 'body.fat', unit: '%' },
  { key: 'muscle_mass_percentage', label: 'body.muscle', unit: '%' },
];
const CIRCUMFERENCE_SERIES = [
  { key: 'chest_size', label: 'body.chest', unit: ' cm' },
  { key: 'waist_size', label: 'body.waist', unit: ' cm' },
  { key: 'arm_size', label: 'body.arm', unit: ' cm' },
  { key: 'leg_size', label: 'body.leg', unit: ' cm' },
];
const HISTORY_SERIES = [...BODY_COMPOSITION_SERIES, ...CIRCUMFERENCE_SERIES];

const hasValue = (v) => v !== null && v !== undefined && v !== '';

const lastValueOf = (data, key) => {
  for (let i = data.length - 1; i >= 0; i--) {
    if (hasValue(data[i][key])) return data[i][key];
  }
  return null;
};

const SPARK_W = 120;
const SPARK_H = 36;

// Una misura: nome, mini grafico con la sua scala (da 2 punti) e ultimo valore
const MeasureRow = ({ series, data, domain }) => {
  const { t } = useTranslation();
  const value = lastValueOf(data, series.key);
  const points = data.filter((d) => hasValue(d[series.key])).map((d) => ({ x: d.day, value: Number(d[series.key]) }));
  const polyline = points.length >= 2 ? buildPoints(points, domain, SPARK_W, SPARK_H, 4) : '';
  return (
    <Box data-measure-row sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, py: 1.25 }}>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 16 }}>{t(series.label)}</Typography>
      {polyline && (
        <Box sx={{ width: { xs: 72, md: 160 }, height: { xs: 28, md: 32 }, flexShrink: 0, color: 'text.secondary' }}>
          <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </Box>
      )}
      <Typography variant="statNumber" sx={{ fontSize: 16, minWidth: { xs: 72, md: 96 }, textAlign: 'right' }}>
        {value !== null ? `${value}${series.unit}` : '—'}
      </Typography>
    </Box>
  );
};

const MeasureCard = ({ title, series, data, domain }) => (
  <Card sx={{ p: '22px' }}>
    <Typography variant="cardTitle" sx={{ mb: 0.5 }}>{title}</Typography>
    {series.map((s) => <MeasureRow key={s.key} series={s} data={data} domain={domain} />)}
  </Card>
);

// Pillole: piena in inchiostro se selezionata, con il contorno le altre (il rosso resta sull'azione principale).
const PeriodChips = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }} role="group" aria-label={t('body.period_label')}>
      {PERIODS.map((period) => {
        const selected = period === value;
        return (
          <Chip
            key={period}
            label={t(PERIOD_UI[period].label)}
            clickable
            variant={selected ? 'filled' : 'outlined'}
            onClick={() => onChange(period)}
            aria-pressed={selected}
            sx={{
              fontSize: 13, height: 32, borderRadius: 999, px: 0.5,
              ...(selected
                ? { bgcolor: 'text.primary', color: 'background.paper', '&:hover, &.Mui-focusVisible': { bgcolor: 'text.primary' } }
                : { borderColor: 'divider', color: 'text.primary' }),
            }}
          />
        );
      })}
    </Box>
  );
};

const headCellSx = { fontWeight: 600, fontSize: 14, color: 'text.secondary' };
const bodyCellSx = { fontSize: 14 };

// Storico sul telefono: data e peso sulla prima linea, le altre misure in grigio sulla seconda
const HistoryList = ({ rows, empty, onDelete }) => {
  const { t } = useTranslation();
  if (empty) {
    return <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center', fontSize: 14 }}>{t('body.empty')}</Typography>;
  }
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {rows.map((row) => {
        const others = HISTORY_SERIES.filter((s) => hasValue(row[s.key]));
        return (
          <Box component="li" key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 0.5, py: 0.75, '& + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontSize: 16 }}>{formatDate(row.date)}</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {row.weight ? <><StatValue row={row} field="weight" /> kg</> : '-'}
                </Typography>
              </Box>
              {others.length > 0 && (
                <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                  {others.map((s, i) => (
                    <Fragment key={s.key}>
                      {i > 0 && ' · '}{t(s.label)} {row[s.key]}{s.unit}{isFromHealth(row, s.key) && <HealthMark />}
                    </Fragment>
                  ))}
                </Typography>
              )}
            </Box>
            <IconButton aria-label={t('common.delete')} onClick={() => onDelete(row.id)} sx={{ width: 44, height: 44, color: 'text.secondary' }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
};

const numberFieldSx = {
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
  '& input[type=number]': { MozAppearance: 'textfield' },
};

const BodyStats = ({ isEmbedded = false }) => {
  const { t } = useTranslation();
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [stats, setStats] = useState([]);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // true finché l'utente non ha dato il consenso per i dati sulla salute
  const [consentRequired, setConsentRequired] = useState(false);
  // true se il consenso era stato dato a una versione precedente del testo
  const [consentUpdated, setConsentUpdated] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [formData, setFormData] = useState({
    date: new Date(),
    weight: '',
    body_fat_percentage: '',
    muscle_mass_percentage: '',
    chest_size: '',
    arm_size: '',
    waist_size: '',
    leg_size: '',
  });

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/read.php`, {
        credentials: 'include',
      });
      const data = await response.json();
      setConsentRequired(data.consent_required === true);
      setConsentUpdated(data.consent_updated === true);
      if (data.records) {
        setStats(data.records);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setSnackbar({ open: true, message: i18n.t('body.error.load'), severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, date });
  };

  const handleSubmit = async () => {
    try {
      const formattedData = {
        ...formData,
        date: formData.date.toISOString().split('T')[0],
        weight: formData.weight || null,
        body_fat_percentage: formData.body_fat_percentage || null,
        muscle_mass_percentage: formData.muscle_mass_percentage || null,
        chest_size: formData.chest_size || null,
        arm_size: formData.arm_size || null,
        waist_size: formData.waist_size || null,
        leg_size: formData.leg_size || null,
      };

      const response = await fetch(`${API_BASE_URL}api/user_stats/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedData),
        credentials: 'include',
      });

      const result = await response.json();
      if (response.ok) {
        setSnackbar({ open: true, message: t('body.saved'), severity: 'success' });
        setIsDialogOpen(false);
        setFormData({
          date: new Date(),
          weight: '',
          body_fat_percentage: '',
          muscle_mass_percentage: '',
          chest_size: '',
          arm_size: '',
          waist_size: '',
          leg_size: '',
        });
        fetchStats();
      } else {
        setSnackbar({ open: true, message: result.message || t('body.error.save'), severity: 'error' });
      }
    } catch (error) {
      console.error('Error saving stats:', error);
      setSnackbar({ open: true, message: t('body.error.connection'), severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('body.confirm_delete'))) return;

    try {
      const response = await fetch(`${API_BASE_URL}api/user_stats/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include',
      });

      if (response.ok) {
        setSnackbar({ open: true, message: t('body.deleted'), severity: 'success' });
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting stat:', error);
    }
  };

  const periodRows = filterByPeriod(stats, period);
  const chartData = periodRows.map(item => ({
    ...item,
    day: dayNumber(item.date),
    dateFormatted: formatDate(item.date, { day: '2-digit', month: '2-digit' }),
  }));

  // Asse x dei grafici: dall'inizio del periodo (con "Tutto" dalla prima misura) a oggi
  const today = dayNumber(new Date());
  const start = periodStart(period);
  const chartDomain = [
    start ? dayNumber(start) : (chartData[0]?.day ?? today),
    Math.max(today, chartData.at(-1)?.day ?? today),
  ];

  const weightPoints = chartData
    .filter(d => d.weight !== null && d.weight !== undefined)
    .map(d => ({ x: d.day, value: d.weight }));
  const lastWeight = lastValueOf(chartData, 'weight');
  const weightDelta = periodWeightDelta(periodRows);
  const trend = weightTrend(weightDelta);
  const deltaText = trend === null ? undefined
    : trend === 'flat' ? t(PERIOD_UI[period].stable)
      : t(PERIOD_UI[period].delta, { delta: `${weightDelta >= 0 ? '+' : ''}${formatNumber(weightDelta, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` });

  // Lo storico non segue il periodo: tutte le righe, dalla più recente, a pagine
  const sortedStats = sortByDate(stats);
  const history = paginate(sortedStats.slice().reverse(), page);
  const latestRow = sortedStats[sortedStats.length - 1];

  const renderContent = () => (consentRequired && !isLoading) ? (
    <HealthConsentCard onGranted={fetchStats} updated={consentUpdated} />
  ) : (
    <>
      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', mb: 3 }}>
        {!isEmbedded && (
          <Typography variant="pageTitle">
            {t('body.title')}
          </Typography>
        )}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsDialogOpen(true)}>
          {t('body.new')}
        </Button>
      </Box>

      {!isLoading && <HealthAppHint alreadySyncing={stats.some((s) => s.health_fields)} />}

      {!isLoading && stats.length > 0 && <PeriodChips value={period} onChange={setPeriod} />}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {stats.length > 0 && periodRows.length === 0 ? (
            <Grid item xs={12}>
              <Card sx={{ p: '28px 22px', textAlign: 'center' }}>
                <EventBusyIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{t('body.period_empty')}</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
                  {t('body.period_empty_last', {
                    date: formatDate(latestRow.date),
                    weight: latestRow.weight ? `${latestRow.weight} kg` : '—',
                  })}
                </Typography>
              </Card>
            </Grid>
          ) : (
            <>
              {/* Andamento Peso — a piena larghezza */}
              <Grid item xs={12}>
                <ChartCard
                  title={t('body.weight_trend')}
                  points={weightPoints}
                  domain={chartDomain}
                  color="primary.main"
                  valueLabel={lastWeight !== null ? `${lastWeight} kg` : '—'}
                  trend={trend}
                  deltaText={deltaText}
                />
              </Grid>

              {/* Composizione corporea */}
              <Grid item xs={12} md={6}>
                <MeasureCard title={t('body.composition')} series={BODY_COMPOSITION_SERIES} data={chartData} domain={chartDomain} />
              </Grid>

              {/* Circonferenze */}
              <Grid item xs={12} md={6}>
                <MeasureCard title={t('body.circumferences')} series={CIRCUMFERENCE_SERIES} data={chartData} domain={chartDomain} />
              </Grid>
            </>
          )}

          {/* Tabella Storico */}
          <Grid item xs={12}>
            <TableContainer component={Card} sx={{ p: 0 }}>
              {isPhone ? (
                <HistoryList rows={history.rows} empty={stats.length === 0} onDelete={handleDelete} />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>{t('body.col.date')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.col.weight')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.col.fat')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.col.muscle')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.chest')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.arm')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.waist')}</TableCell>
                      <TableCell align="right" sx={headCellSx}>{t('body.leg')}</TableCell>
                      <TableCell align="center" sx={headCellSx}>{t('body.col.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell sx={bodyCellSx}>{formatDate(row.date)}</TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700 }}><StatValue row={row} field="weight" /></TableCell>
                        <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="body_fat_percentage" /></TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{row.muscle_mass_percentage || '-'}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{row.chest_size || '-'}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{row.arm_size || '-'}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}><StatValue row={row} field="waist_size" /></TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{row.leg_size || '-'}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" aria-label={t('common.delete')} onClick={() => handleDelete(row.id)} sx={{ color: 'text.secondary' }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {stats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3, fontSize: 14 }}>{t('body.empty')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {history.total > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                  <IconButton size="small" disabled={history.page === 0} onClick={() => setPage(0)} aria-label={t('body.page_first')}>
                    <FirstPageIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={history.page === 0} onClick={() => setPage(history.page - 1)} aria-label={t('body.page_prev')}>
                    <NavigateBeforeIcon fontSize="small" />
                  </IconButton>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                    {t('body.page_range', { from: history.from, to: history.to, total: history.total })}
                  </Typography>
                  <IconButton size="small" disabled={history.page === history.lastPage} onClick={() => setPage(history.page + 1)} aria-label={t('body.page_next')}>
                    <NavigateNextIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={history.page === history.lastPage} onClick={() => setPage(history.lastPage)} aria-label={t('body.page_last')}>
                    <LastPageIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </TableContainer>
          </Grid>
        </Grid>
      )}
    </>
  );

  return (
    <>
      {isEmbedded ? (
        <Box sx={{ mt: 2 }}>{renderContent()}</Box>
      ) : (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>{renderContent()}</Container>
      )}

      {/* Dialog Nuova Misurazione */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('body.dialog_title')}</DialogTitle>
        <DialogContent dividers>
          <DateLocalization>
            <DatePicker
              label={t('body.field.date')}
              value={formData.date}
              onChange={handleDateChange}
              slotProps={{ textField: { fullWidth: true, sx: { mb: 3, mt: 1 } } }}
            />
          </DateLocalization>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label={t('body.field.weight')} name="weight" type="number" fullWidth value={formData.weight} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label={t('body.field.fat')} name="body_fat_percentage" type="number" fullWidth value={formData.body_fat_percentage} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label={t('body.field.muscle')} name="muscle_mass_percentage" type="number" fullWidth value={formData.muscle_mass_percentage} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label={t('body.field.chest')} name="chest_size" type="number" fullWidth value={formData.chest_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label={t('body.field.arm')} name="arm_size" type="number" fullWidth value={formData.arm_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label={t('body.field.waist')} name="waist_size" type="number" fullWidth value={formData.waist_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label={t('body.field.leg')} name="leg_size" type="number" fullWidth value={formData.leg_size} onChange={handleInputChange} sx={numberFieldSx} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default BodyStats;

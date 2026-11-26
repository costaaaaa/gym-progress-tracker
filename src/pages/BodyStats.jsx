import { useState } from 'react';
import { Typography, Grid, Box, Card, Snackbar, Alert, CircularProgress, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { formatDate, intlLocale } from '../i18n/format';
import { useAuth } from '../context/AuthContext';
import { BODY_LB_DIVISIONS, formatWeightInUnit } from '../utils/weightUnit';
import { lengthUnitLabel } from '../utils/lengthUnit';
import { dayNumber } from '../utils/calendarDay';
import ConfirmDialog from '../components/ConfirmDialog';
import HealthConsentCard from '../components/HealthConsentCard';
import HealthAppHint from '../components/HealthAppHint';
import { DEFAULT_PERIOD, filterByPeriod, periodStart, sortByDate, paginate } from '../utils/bodyStatsPeriod';
import { useOncePerRequest } from '../hooks/useNavigationRequest';
import { TITLE_ROW_BUTTON } from '../utils/buttonStyles';
import useBodyStats from './body/useBodyStats';
import PeriodChips from './body/PeriodChips';
import WeightCard from './body/WeightCard';
import MeasureCard from './body/MeasureCard';
import BodyHistory from './body/BodyHistory';
import LoadError from './progress/LoadError';
import NewMeasurementDialog from './body/NewMeasurementDialog';
import { BODY_COMPOSITION_SERIES, CIRCUMFERENCE_SERIES } from './body/series';

// `openRequest`: un numero che cresce a ogni richiesta di aprire «Nuova misurazione» (dal ventaglio); si apre una volta
// per numero, a dati caricati e solo con il consenso ai dati sulla salute (come il pulsante della pagina).
// La lettura e i comandi sono di useBodyStats; qui si compone la pagina.
const BodyStats = ({ isEmbedded = false, openRequest = null }) => {
  const { t } = useTranslation();
  const { weightUnit } = useAuth();
  const { stats, loading, loadFailed, consentRequired, consentUpdated, refresh, save, remove } = useBodyStats();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [page, setPage] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const notify = (message, severity) => setSnackbar({ open: true, message, severity });

  useOncePerRequest(openRequest, !loading, () => { if (!consentRequired) setIsDialogOpen(true); });

  const [idToDelete, setIdToDelete] = useState(null);
  const confirmDelete = async () => {
    const id = idToDelete;
    setIdToDelete(null);
    const result = await remove(id);
    if (result.ok) notify(t('body.deleted'), 'success');
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

  // Lo storico non segue il periodo: tutte le righe, dalla più recente, a pagine
  const sortedStats = sortByDate(stats);
  const history = paginate(sortedStats.slice().reverse(), page);
  const latestRow = sortedStats[sortedStats.length - 1];

  // La lettura fallita vince sul consenso: dopo «Acconsento» una rilettura che non riesce non rimette la card come se niente fosse
  const renderContent = () => (consentRequired && !loading && !loadFailed) ? (
    <HealthConsentCard onGranted={refresh} updated={consentUpdated} />
  ) : (
    <>
      <Box sx={{ display: 'flex', justifyContent: isEmbedded ? 'flex-end' : 'space-between', alignItems: 'center', mb: 3 }}>
        {!isEmbedded && (
          <Typography variant="pageTitle">
            {t('body.title')}
          </Typography>
        )}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsDialogOpen(true)} sx={{ ...(!isEmbedded && TITLE_ROW_BUTTON), fontSize: 16 }}>
          {t('body.new')}
        </Button>
      </Box>

      {/* Lettura fallita: l'errore al posto dei dati, diverso dalla pagina vuota */}
      {loadFailed && <LoadError message={t('body.error.load')} onRetry={refresh} />}

      {!loading && !loadFailed && <HealthAppHint alreadySyncing={stats.some((s) => s.health_fields)} />}

      {!loading && !loadFailed && stats.length > 0 && <PeriodChips value={period} onChange={setPeriod} />}

      {loadFailed ? null : loading ? (
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
                <Typography sx={{ color: 'text.secondary', fontSize: 16, mt: 0.5 }}>
                  {t('body.period_empty_last', {
                    date: formatDate(latestRow.date),
                    weight: formatWeightInUnit(latestRow.weight, weightUnit, intlLocale(), { lbDivisions: BODY_LB_DIVISIONS }),
                  })}
                </Typography>
              </Card>
            </Grid>
          ) : (
            <>
              {/* Andamento Peso — a piena larghezza */}
              <Grid item xs={12}>
                <WeightCard data={chartData} domain={chartDomain} period={period} weightUnit={weightUnit} />
              </Grid>

              {/* Composizione corporea */}
              <Grid item xs={12} md={6}>
                <MeasureCard title={t('body.composition')} series={BODY_COMPOSITION_SERIES} data={chartData} domain={chartDomain} weightUnit={weightUnit} />
              </Grid>

              {/* Circonferenze */}
              <Grid item xs={12} md={6}>
                <MeasureCard title={t('body.circumferences', { unit: lengthUnitLabel(weightUnit) })} series={CIRCUMFERENCE_SERIES} data={chartData} domain={chartDomain} weightUnit={weightUnit} />
              </Grid>
            </>
          )}

          {/* Tabella Storico */}
          <Grid item xs={12}>
            <BodyHistory history={history} empty={stats.length === 0} onDelete={setIdToDelete} onPageChange={setPage} weightUnit={weightUnit} />
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
        <Box sx={{ mt: 4, mb: 4 }}>{renderContent()}</Box>
      )}

      <ConfirmDialog
        open={idToDelete !== null}
        title={t('body.delete.title')}
        text={t('body.confirm_delete')}
        cta={t('common.delete')}
        onConfirm={confirmDelete}
        onClose={() => setIdToDelete(null)}
      />
      <NewMeasurementDialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} save={save} onNotify={notify} weightUnit={weightUnit} />

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

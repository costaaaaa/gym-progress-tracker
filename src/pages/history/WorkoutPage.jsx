import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CircularProgress, Snackbar, Typography } from '@mui/material';
import { format, subDays } from 'date-fns';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BackArrow from '../../components/BackArrow';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from '../../hooks/usePageMeta';
import { isModuleActive } from '../../hooks/useModule';
import { useAuth } from '../../context/AuthContext';
import { useSnackbarAboveBar } from '../../hooks/useSnackbarAboveBar';
import EditWorkoutDateDialog from '../../components/EditWorkoutDateDialog';
import ShareCardDialog from '../../components/ShareCardDialog';
import TimeZoneBadge from '../../components/TimeZoneBadge';
import { formatClockTime, formatDate, formatSetText } from '../../i18n/format';
import { track } from '../../utils/analytics';
import { clockDay } from '../../utils/calendarDay';
import { DANGER_TEXT, NEUTRAL_OUTLINED } from '../../utils/buttonStyles';
import useWorkoutHistory from './useWorkoutHistory';
import WorkoutDetail from './WorkoutDetail';
import DeleteWorkoutDialog from './DeleteWorkoutDialog';
import { durationText, workoutTitle } from './workoutText';
import { formatVolume } from '../formatVolume';

const FULL_DAY = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const DATE_LOCKED_ID = 'workout-date-locked';
// Il nome di ogni tipo di record (come negli altri punti dell'app: «1RM stimato», «Max ripetizioni»)
const RECORD_LABEL_KEY = { weight: 'history.pr.weight', oneRM: 'history.pr.one_rm', reps: 'history.pr.reps' };

// Pagina di un allenamento (/storico/:id): titolo, data e ora, riquadri (durata, volume, serie), i record battuti, il
// dettaglio di esercizi e serie, e le azioni: Condividi, Cambia data, Elimina. Eliminato, si torna all'elenco, che fa
// l'eliminazione con «Annulla».
const WorkoutPage = () => {
  const { t } = useTranslation();
  const noticeSx = useSnackbarAboveBar();
  const { id } = useParams();
  const navigate = useNavigate();
  // La riga dell'elenco o del calendario porta il suo percorso nello stato: ritorno, eliminazione e allenamento che non c'è
  // tornano lì, con la vista, il mese e il giorno di prima
  const { state } = useLocation();
  const backPath = typeof state?.backTo === 'string' && /^\/storico(\?|$)/.test(state.backTo) ? state.backTo : '/storico';
  const { weightUnit, user } = useAuth();
  // Punti, streak e traguardi nelle anteprime sono del modulo Livelli: non attivo = non si mostrano
  const levelsOn = isModuleActive(user, 'levels');
  const {
    workouts, summaries, loading, loadFailed, refresh, snackbar, closeSnackbar,
    previewDelete, moveWorkoutDate, shareStatsFor,
  } = useWorkoutHistory();
  const workout = workouts.find((w) => String(w.id) === id);
  usePageMeta(workout ? workoutTitle(workout) : t('nav.history'), t('history.meta.description'));
  const [shareStats, setShareStats] = useState(null); // card da condividere, null = dialog chiuso
  const [openEditDate, setOpenEditDate] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Un allenamento che non c'è (o non è dell'utente) riporta al percorso di ritorno (di base l'elenco), ma solo a lettura finita e riuscita
  useEffect(() => {
    if (!loading && !loadFailed && !workout) navigate(backPath, { replace: true });
  }, [loading, loadFailed, workout, navigate, backPath]);

  // Il server sposta solo gli allenamenti degli ultimi 30 giorni
  const oldestMovable = useMemo(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'), []);
  const day = workout ? clockDay(workout.date) : null;
  const dateLocked = day !== null && day < oldestMovable;

  const handleShare = () => {
    setShareStats(shareStatsFor(workout));
    track('workout_card', { action: 'open', from: 'history' });
  };

  // Alla conferma si torna all'elenco con l'id: è l'elenco a eliminare, con «Annulla» per 10 secondi
  const handleConfirmDelete = (toDelete) => {
    setOpenDelete(false);
    navigate(backPath, { replace: true, state: { deleted: toDelete.id } });
  };

  const recordLine = (record) => {
    const label = t(RECORD_LABEL_KEY[record.type]);
    return record.type === 'reps' ? `${label} · ${record.reps}` : `${label} · ${formatSetText(record.weight, record.reps, weightUnit)}`;
  };

  const back = (
    <BackArrow to={backPath} label={t('nav.history')} />
  );

  const body = () => {
    if (loadFailed) {
      return (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {back}
            <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0 }}>{t('nav.history')}</Typography>
          </Box>
          <Alert severity="error" action={<Button color="inherit" onClick={refresh} sx={{ minHeight: 44, fontWeight: 600 }}>{t('history.retry')}</Button>}>
            {t('history.load_error')}
          </Alert>
        </>
      );
    }
    if (!workout) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

    const summary = summaries[workout.id];
    const tiles = [
      [t('history.duration'), durationText(workout.duration_seconds) ?? '–'],
      [t('history.volume'), formatVolume(summary.volumeKg, weightUnit)],
      [t('history.sets'), String(summary.sets)],
    ];
    return (
      <>
        {/* Con un titolo su più righe la freccia resta all'altezza della prima */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
          {back}
          <Typography variant="pageTitle" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{workoutTitle(workout)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
          <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{`${formatDate(workout.date, FULL_DAY)} · ${formatClockTime(workout.date)}`}</Typography>
          <TimeZoneBadge workout={workout} sx={{ fontSize: 16 }} />
        </Box>

        {/* Tre colonne uguali a ogni larghezza; sotto sm riempimento e spazi stretti. Il valore (anche «4.820,5 kg») sta su una riga
            se ci sta, altrimenti va a capo: con colonne uguali e senza capo uscirebbe dal riquadro a 320 px */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1, sm: 1.5 }, mb: 2.5 }}>
          {tiles.map(([label, value]) => (
            <Card key={label} sx={{ p: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
              <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontSize: { xs: 16, sm: 20 }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</Typography>
            </Card>
          ))}
        </Box>

        {summary.records.length > 0 && (
          <Card component="section" sx={{ p: 2.5, mb: 2.5 }}>
            <Typography component="h2" variant="cardTitle" sx={{ mb: 1.5 }}>{t('history.pr.label')}</Typography>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {summary.records.map((record, i) => (
                // voci senza stato e due esercizi possono avere lo stesso nome (anche dopo il ricalcolo per «Cambia data»): il nome non fa da chiave, l'indice sì
                <li key={i}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, overflowWrap: 'anywhere' }}>{record.name}</Typography>
                  <Typography sx={{ fontSize: 16, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{recordLine(record)}</Typography>
                </li>
              ))}
            </Box>
          </Card>
        )}

        <Card sx={{ pt: 2, mb: 3 }}>
          <WorkoutDetail workout={workout} weightUnit={weightUnit} />
        </Card>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button variant="outlined" onClick={handleShare} sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, fontWeight: 600 }}>
              {t('history.share')}
            </Button>
            <Button
              variant="outlined"
              disabled={dateLocked}
              aria-describedby={dateLocked ? DATE_LOCKED_ID : undefined}
              onClick={() => setOpenEditDate(true)}
              sx={{ ...NEUTRAL_OUTLINED, minHeight: 44, fontWeight: 600 }}
            >
              {t('history.change_date')}
            </Button>
          </Box>
          <Button onClick={() => setOpenDelete(true)} sx={{ ...DANGER_TEXT, minHeight: 44, mx: -1 }}>
            {t('history.delete_action')}
          </Button>
        </Box>
        {dateLocked && <Typography id={DATE_LOCKED_ID} sx={{ mt: 1, fontSize: 16, color: 'text.secondary' }}>{t('history.date.too_old')}</Typography>}
      </>
    );
  };

  return (
    <Box sx={{ pb: 3 }}>
      {body()}

      <ShareCardDialog open={!!shareStats} stats={shareStats} weightUnit={weightUnit} onClose={() => setShareStats(null)} />
      <EditWorkoutDateDialog
        open={openEditDate}
        onClose={() => setOpenEditDate(false)}
        workout={openEditDate ? workout : null}
        onUpdateSuccess={moveWorkoutDate}
        weightUnit={weightUnit}
        showLevels={levelsOn}
      />
      <DeleteWorkoutDialog
        workout={openDelete ? workout : null}
        onClose={() => setOpenDelete(false)}
        onConfirm={handleConfirmDelete}
        previewDelete={previewDelete}
        showLevels={levelsOn}
        weightUnit={weightUnit}
      />
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={closeSnackbar} sx={noticeSx}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkoutPage;

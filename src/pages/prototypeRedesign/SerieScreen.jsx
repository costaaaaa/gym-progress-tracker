// PROTOTIPO (da buttare): schermata della serie del Focus, minimale, a schermo intero
import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, IconButton, LinearProgress, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckIcon from '@mui/icons-material/Check';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import SpeedIcon from '@mui/icons-material/Speed';
import Sheet from './Sheet';
import Stepper from './Stepper';
import SetsSheet from './SetsSheet';
import { toNum, platesText } from './numbers';
import { iconBtnSx } from './styles';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY, TABULAR } from '../../utils/fonts';
import { BELOW_360 } from '../../theme/narrowScreens';

const TECHNIQUES = ['Drop set', 'Rest pause', 'Myo-reps', 'Negative'];
const MENU = ['Salta riscaldamento', 'Salta serie', 'Salta esercizio', 'Cambia esercizio', 'Aggiungi esercizio', 'Termina allenamento'];
const Dot = ({ set, state }) => (
  <Box
    sx={{
      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
      border: '2px solid', borderColor: state === 'done' ? 'success.main' : state === 'active' ? 'text.primary' : 'divider',
      bgcolor: state === 'done' ? 'success.main' : 'transparent', color: state === 'done' ? 'success.contrastText' : state === 'active' ? 'text.primary' : 'text.secondary',
    }}
  >
    {state === 'done' ? <CheckIcon sx={{ fontSize: 17 }} /> : set.label}
  </Box>
);

const SerieScreen = ({ wk, tools, tecniche, bozza, onExit, go }) => {
  const { sets, setSets, weight, setWeight, reps, setReps } = wk;
  const [tech, setTech] = useState(null);
  const [suggest, setSuggest] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [notice, setNotice] = useState('');
  const [rir, setRir] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const current = sets.findIndex((s) => s.w == null);
  const allDone = current === -1;
  const doneCount = sets.filter((s) => s.w != null).length;
  const confirm = () => {
    if (allDone) return;
    setSets((ss) => ss.map((s, i) => (i === current ? { ...s, w: toNum(weight), r: toNum(reps) } : s)));
    setTech(null);
    if (tools.timer) go('recupero');
    else setNotice('Serie confermata');
  };
  const close = () => setSheet(null);
  const pick = (label) => {
    close();
    if (label === 'Termina allenamento') go('riepilogo');
    else setNotice(`${label}: nel prossimo giro`);
  };

  return (
    <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary' }}>
      <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, height: 52 }}>
        <IconButton aria-label="Esci dall'allenamento" onClick={onExit} sx={{ width: 44, height: 44 }}><CloseIcon /></IconButton>
        <Typography sx={{ ...TABULAR, fontWeight: 700 }}>24:10</Typography>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, textAlign: 'center' }}>esercizio 2 di 6</Typography>
        <IconButton aria-label="Altre azioni" onClick={() => setSheet('menu')} sx={{ width: 44, height: 44 }}><MoreHorizIcon /></IconButton>
      </Box>
      <LinearProgress variant="determinate" value={(1 / 6) * 100} aria-label="Avanzamento dell'allenamento" sx={{ height: 3, flex: '0 0 auto' }} />

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'primary.text' }}>Dorsali</Typography>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 600, fontSize: '1.35rem', lineHeight: 1.2 }}>Lat machine presa larga</Typography>
          <Typography variant="body2" color="text.secondary">{bozza ? 'Serie 7 di 18 · ' : ''}Gomiti verso i fianchi</Typography>
        </Box>

        <ButtonBase onClick={() => setSheet('fatte')} aria-label="Serie fatte" sx={{ justifyContent: 'flex-start', gap: 1.25, minHeight: 44, borderRadius: radius.md, alignSelf: 'flex-start' }}>
          {sets.map((s, i) => <Dot key={i} set={s} state={s.w != null ? 'done' : i === current ? 'active' : 'todo'} />)}
        </ButtonBase>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.lg, px: 1.5, py: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={TABULAR}>Ultima volta: 60 kg × 10</Typography>
          {suggest && tools.suggerito && (
            <ButtonBase onClick={() => setSheet('perche')} sx={{ minHeight: 36, px: 1, borderRadius: radius.md, color: 'primary.text', fontWeight: 700, fontSize: 14 }}>
              Oggi prova 62,5 kg
            </ButtonBase>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, [BELOW_360]: { flexDirection: 'column', gap: 1 } }}>
          <Stepper label="Peso (kg)" value={weight} onChange={setWeight} step={2.5} decimal />
          <Stepper label="Ripetizioni" value={reps} onChange={setReps} step={1} />
        </Box>

        <Box role="group" aria-label="Tecnica" sx={{ display: 'flex', gap: 1, flexWrap: tecniche === 'capo' ? 'wrap' : 'nowrap', overflowX: tecniche === 'capo' ? 'visible' : 'auto', mx: tecniche === 'capo' ? 0 : -2, px: tecniche === 'capo' ? 0 : 2, flex: '0 0 auto', pb: 0.25 }}>
          {TECHNIQUES.map((t) => {
            const on = tech === t;
            return (
              <ButtonBase
                key={t}
                aria-pressed={on}
                onClick={() => setTech(on ? null : t)}
                sx={{ flex: '0 0 auto', minHeight: 40, px: 1.75, borderRadius: radius.pill, fontSize: 14, fontWeight: 600, border: '1px solid', borderColor: on ? 'text.primary' : 'divider', bgcolor: on ? 'text.primary' : 'transparent', color: on ? 'background.default' : 'text.primary' }}
              >
                {t}
              </ButtonBase>
            );
          })}
        </Box>

        {(tools.nota || tools.dischi || tools.rir) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {tools.nota && <IconButton aria-label="Nota per la serie" onClick={() => setSheet('nota')} sx={iconBtnSx}><EditNoteIcon /></IconButton>}
            {tools.dischi && <IconButton aria-label="Dischi" onClick={() => setSheet('dischi')} sx={iconBtnSx}><DonutLargeIcon /></IconButton>}
            {tools.rir && <IconButton aria-label="RIR e RPE" onClick={() => setSheet('rir')} sx={iconBtnSx}><SpeedIcon /></IconButton>}
          </Box>
        )}
      </Box>

      <Box sx={{ flex: '0 0 auto', px: 2, pb: 2, pt: 0.5 }}>
        <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ minHeight: 22, textAlign: 'center' }}>{notice}</Typography>
        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<CheckIcon />}
          onClick={confirm}
          disabled={allDone}
          sx={{ py: 2, fontSize: '1.2rem', fontWeight: 700, letterSpacing: 1, bgcolor: 'success.main', color: 'success.contrastText', borderRadius: radius.xl, boxShadow: 'none', '&:hover': { bgcolor: 'success.dark', boxShadow: 'none' } }}
        >
          {allDone ? 'Esercizio completato' : 'Conferma serie'}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>{doneCount} di {sets.length} serie</Typography>
      </Box>

      <Sheet open={sheet === 'menu'} onClose={close} title="Altre azioni">
        {MENU.map((m) => (
          <ButtonBase key={m} onClick={() => pick(m)} sx={{ width: '100%', justifyContent: 'flex-start', minHeight: 52, px: 1, borderRadius: radius.lg, fontWeight: 500 }}>{m}</ButtonBase>
        ))}
      </Sheet>

      {sheet === 'fatte' && <SetsSheet sets={sets} onChange={setSets} onClose={close} />}

      <Sheet open={sheet === 'perche'} onClose={close} title="Perché 62,5 kg">
        <Typography sx={{ mb: 2 }}>L'ultima volta hai chiuso tutte le serie a 10 ripetizioni.</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={close} sx={{ minHeight: 44 }}>Ok</Button>
          <Button onClick={() => { setSuggest(false); close(); }} sx={{ minHeight: 44 }}>Non suggerire più</Button>
        </Box>
      </Sheet>

      <Sheet open={sheet === 'nota'} onClose={close} title="Nota per la serie">
        <TextField fullWidth multiline minRows={2} placeholder="Es. ultima ripetizione lenta" slotProps={{ htmlInput: { 'aria-label': 'Nota per la serie' } }} />
      </Sheet>

      <Sheet open={sheet === 'dischi'} onClose={close} title="Dischi">
        <Typography sx={TABULAR}>{weight} kg con il bilanciere da 20 kg</Typography>
        <Typography sx={{ fontWeight: 700, mt: 1 }}>Per lato: {platesText(weight)} kg</Typography>
      </Sheet>

      <Sheet open={sheet === 'rir'} onClose={close} title="Ripetizioni in riserva (RIR)">
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <ButtonBase key={n} aria-pressed={rir === n} onClick={() => setRir(n)} sx={{ width: 48, height: 48, borderRadius: radius.lg, border: '1px solid', borderColor: rir === n ? 'text.primary' : 'divider', bgcolor: rir === n ? 'text.primary' : 'transparent', color: rir === n ? 'background.default' : 'text.primary', fontWeight: 700 }}>{n}</ButtonBase>
          ))}
        </Box>
      </Sheet>
    </Box>
  );
};

export default SerieScreen;

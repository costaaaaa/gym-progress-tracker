// PROTOTIPO (da buttare): pagina Storico (elenco, calendario, dettaglio allenamento)
import { useState } from 'react';
import { Box, Button, ButtonBase, IconButton, Typography } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Sheet from './Sheet';
import { Back, Chip, NavRow, Seg } from './ui';
import { cardSx, labelSx, titleSx } from './styles';
import { HISTORY, MONTHS, dateLabel } from './data';
import { radius } from '../../theme/radius';
import { TABULAR } from '../../utils/fonts';

const DETAIL_SETS = [['Panca piana', '80 × 8, 80 × 8, 80 × 7, 77,5 × 6'], ['Military press', '40 × 10, 40 × 9, 40 × 8'], ['Croci ai cavi', '15 × 12, 15 × 12, 15 × 10']];
const monthKey = (iso) => iso.slice(0, 7);
const labelOf = (key) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
const sub = (w) => (w.kind === 'cardio' ? `${w.min} min · ${w.km} km` : `${w.min} min · ${w.vol} kg`);

const Row = ({ w, onClick }) => (
  <ButtonBase onClick={onClick} sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', textAlign: 'left', gap: 1, minHeight: 60, px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 600 }}>{w.day}</Typography>
      <Typography variant="body2" color="text.secondary" sx={TABULAR}>{dateLabel(w.date)} · {sub(w)}</Typography>
    </Box>
    {w.record && <Typography sx={{ flex: '0 0 auto', px: 1, py: 0.25, borderRadius: radius.pill, border: '1px solid', borderColor: 'warning.text', color: 'warning.text', fontSize: 12, fontWeight: 700 }}>record</Typography>}
  </ButtonBase>
);

const Calendar = ({ list, onOpen }) => {
  const [offset, setOffset] = useState(0); // 0 = novembre 2026
  const [picked, setPicked] = useState('2026-11-18');
  const y = 2026;
  const m = 10 + offset; // indice del mese
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // lunedì = 0
  const days = new Date(y, m + 1, 0).getDate();
  const key = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const on = (d) => list.filter((w) => w.date === key(d));
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const dayList = list.filter((w) => w.date === picked);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ ...cardSx, p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <IconButton aria-label="Mese precedente" onClick={() => setOffset((o) => o - 1)} sx={{ width: 44, height: 44 }}><ChevronLeftIcon /></IconButton>
          <Typography sx={{ ...titleSx, textTransform: 'capitalize' }}>{MONTHS[(m + 12) % 12]} {y}</Typography>
          <IconButton aria-label="Mese successivo" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} sx={{ width: 44, height: 44 }}><ChevronRightIcon /></IconButton>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <Typography key={i} variant="caption" color="text.secondary" sx={{ py: 0.5 }}>{d}</Typography>)}
          {cells.map((d, i) => {
            if (d == null) return <Box key={`v${i}`} />;
            const ws = on(d);
            const sel = key(d) === picked;
            return (
              <ButtonBase key={d} onClick={() => setPicked(key(d))} aria-label={`${d} ${MONTHS[(m + 12) % 12]}${ws.length ? `, ${ws.length} allenamento` : ''}`} aria-pressed={sel} sx={{ flexDirection: 'column', minHeight: 44, borderRadius: radius.md, border: '1px solid', borderColor: sel ? 'text.primary' : 'transparent', ...TABULAR, fontSize: 14 }}>
                {d}
                <Box sx={{ height: 6, display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {ws.map((w) => <Box key={w.id} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: w.kind === 'cardio' ? 'recovery.recovering' : 'primary.text' }} />)}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Typography variant="caption" sx={{ color: "primary.text" }}>● pesi</Typography>
          <Typography variant="caption" sx={{ color: 'recovery.recovering' }}>● cardio</Typography>
        </Box>
      </Box>
      <Box sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
        <Typography sx={{ ...labelSx, px: 2, pt: 1.5, pb: 1 }}>{dateLabel(picked)}</Typography>
        {dayList.length ? dayList.map((w) => <Row key={w.id} w={w} onClick={() => onOpen(w.id)} />) : <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>Nessun allenamento in questo giorno.</Typography>}
      </Box>
    </Box>
  );
};

const WorkoutDetail = ({ w, onBack, onDelete }) => {
  const [sheet, setSheet] = useState(null);
  const cardio = w.kind === 'cardio';
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Back onClick={onBack} />
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={{ ...titleSx, fontSize: '1.3rem', fontWeight: 700 }} noWrap>{w.day}</Typography>
          <Typography variant="body2" color="text.secondary">{dateLabel(w.date)}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {(cardio ? [['Durata', `${w.min} min`], ['Distanza', `${w.km} km`], ['Ritmo', '5:42/km']] : [['Durata', `${w.min} min`], ['Volume', `${w.vol} kg`], ['Serie', '17']]).map(([l, v]) => (
          <Box key={l} sx={{ ...cardSx, p: 1.5, textAlign: 'center' }}>
            <Typography sx={{ ...TABULAR, fontWeight: 700 }}>{v}</Typography>
            <Typography variant="caption" color="text.secondary">{l}</Typography>
          </Box>
        ))}
      </Box>
      {!cardio && (
        <Box sx={cardSx}>
          <Typography sx={labelSx}>Serie per esercizio</Typography>
          {DETAIL_SETS.map(([n, s]) => (
            <Box key={n} sx={{ mt: 1.25 }}>
              <Typography sx={{ fontWeight: 600 }}>{n}</Typography>
              <Typography variant="body2" color="text.secondary" sx={TABULAR}>{s}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" color="inherit" onClick={() => setSheet('Condividi')} sx={{ minHeight: 44, borderRadius: radius.lg, fontWeight: 600 }}>Condividi</Button>
        <Button variant="outlined" color="inherit" onClick={() => setSheet('Cambia data')} sx={{ minHeight: 44, borderRadius: radius.lg, fontWeight: 600 }}>Cambia data</Button>
        <Button color="error" onClick={() => setSheet('Elimina')} sx={{ minHeight: 44, fontWeight: 600 }}>Elimina</Button>
      </Box>
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet === 'Elimina' ? 'Eliminare questo allenamento?' : sheet}>
        {sheet === 'Elimina'
          ? <Button fullWidth color="error" variant="contained" onClick={onDelete} sx={{ minHeight: 48, borderRadius: radius.lg, fontWeight: 700 }}>Elimina</Button>
          : <Typography color="text.secondary">Finto: nel prototipo qui non si scrive niente.</Typography>}
      </Sheet>
    </Box>
  );
};

const StoricoPage = ({ values, flags, detail, set, setMany }) => {
  const [filter, setFilter] = useState('tutti');
  const [removed, setRemoved] = useState([]);
  const [menu, setMenu] = useState(null);
  const all = HISTORY.filter((w) => !removed.includes(w.id));
  const list = all.filter((w) => (flags.cardio ? (filter === 'tutti' || w.kind === filter) : w.kind === 'pesi'));
  const open = all.find((w) => w.id === Number(detail('allenamento')));
  if (open) return <WorkoutDetail w={open} onBack={() => setMany({ allenamento: null })} onDelete={() => { setRemoved((r) => [...r, open.id]); setMany({ allenamento: null }); }} />;

  const months = [...new Set(list.map((w) => monthKey(w.date)))];
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
        <Typography component="h1" sx={{ ...titleSx, fontSize: '1.4rem', fontWeight: 700 }}>Storico</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button color="inherit" onClick={() => setMenu('passato')} sx={{ minHeight: 44, fontWeight: 600, fontSize: 13, textAlign: 'right', lineHeight: 1.2 }}>Registra allenamento passato</Button>
          <IconButton aria-label="Altre azioni" onClick={() => setMenu('altro')} sx={{ width: 44, height: 44 }}><MoreHorizIcon /></IconButton>
        </Box>
      </Box>
      <Seg label="Vista" value={values.vista} onChange={(v) => set('vista', v)} options={[{ value: 'elenco', label: 'Elenco' }, { value: 'calendario', label: 'Calendario' }]} />
      {flags.cardio && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[['tutti', 'Tutti'], ['pesi', 'Pesi'], ['cardio', 'Cardio']].map(([v, l]) => <Chip key={v} on={filter === v} onClick={() => setFilter(v)}>{l}</Chip>)}
        </Box>
      )}
      {values.vista === 'calendario'
        ? <Calendar list={list} onOpen={(id) => setMany({ allenamento: id })} />
        : months.map((mk) => (
          <Box key={mk} sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
            <Typography sx={{ ...labelSx, px: 2, pt: 1.5, pb: 1 }}>{labelOf(mk)}</Typography>
            {list.filter((w) => monthKey(w.date) === mk).map((w) => <Row key={w.id} w={w} onClick={() => setMany({ allenamento: w.id })} />)}
          </Box>
        ))}
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu === 'passato' ? 'Registra allenamento passato' : 'Altre azioni'}>
        {menu === 'passato'
          ? <Typography color="text.secondary">Finto: qui scegli la data e inserisci le serie.</Typography>
          : <Box sx={{ ml: -2, mr: -2 }}><NavRow title="Importa da un'altra app" onClick={() => setMenu(null)} /></Box>}
      </Sheet>
    </Box>
  );
};

export default StoricoPage;

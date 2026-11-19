// PROTOTIPO (da buttare): pagina Schede (elenco, nuova scheda, pagina scheda con modifica, tutti gli esercizi)
import { useState } from 'react';
import { Box, Button, ButtonBase, IconButton, TextField, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import Sheet from './Sheet';
import { Back, NavRow, PageTitle } from './ui';
import { cardSx, titleSx } from './styles';
import { CATALOG, PLANS } from './data';
import { radius } from '../../theme/radius';
import { TABULAR } from '../../utils/fonts';

const NEW_OPTIONS = [['Da zero', 'Scegli tu giorni ed esercizi'], ['Da una scheda pronta', 'Parti da un modello e cambialo'], ['Importa', 'Da un file o da un\'altra app']];
const smallBtn = { minHeight: 44, borderRadius: radius.lg, fontWeight: 600 };

const Catalog = ({ onBack }) => {
  const [q, setQ] = useState('');
  const list = CATALOG.filter((n) => n.toLowerCase().includes(q.toLowerCase()));
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Back onClick={onBack} /><PageTitle>Tutti gli esercizi</PageTitle></Box>
      <TextField size="small" placeholder="Cerca un esercizio" value={q} onChange={(e) => setQ(e.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Cerca un esercizio' } }} />
      <Box sx={{ ...cardSx, p: 0 }}>
        {list.map((n, i) => (
          <Typography key={n} sx={{ px: 2, py: 1.5, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>{n}</Typography>
        ))}
        {!list.length && <Typography color="text.secondary" sx={{ p: 2 }}>Nessun esercizio</Typography>}
      </Box>
      <Typography variant="body2" color="text.secondary">Elenco finto: qui arriva il catalogo vero con i tuoi esercizi.</Typography>
    </Box>
  );
};

const PlanPage = ({ plan, active, onActivate, onBack, onStart, onChange }) => {
  const [edit, setEdit] = useState(false);
  const [sheet, setSheet] = useState(null);
  const setDays = (fn) => onChange({ ...plan, days: fn(plan.days) });
  const move = (di, ei, d) => setDays((days) => days.map((day, i) => {
    if (i !== di) return day;
    const ex = [...day.ex];
    [ex[ei], ex[ei + d]] = [ex[ei + d], ex[ei]];
    return { ...day, ex };
  }));
  const remove = (di, ei) => setDays((days) => days.map((day, i) => (i === di ? { ...day, ex: day.ex.filter((_, j) => j !== ei) } : day)));

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Back onClick={onBack} />
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography component="h1" sx={{ ...titleSx, fontSize: '1.3rem', fontWeight: 700 }} noWrap>{plan.name}</Typography></Box>
        <Button color="inherit" onClick={() => setEdit((e) => !e)} sx={{ minHeight: 44, fontWeight: 700 }}>{edit ? 'Fatto' : 'Modifica'}</Button>
      </Box>
      {active
        ? <Typography sx={{ alignSelf: 'flex-start', px: 1.25, py: 0.5, borderRadius: radius.pill, bgcolor: 'success.main', color: '#fff', fontSize: 13, fontWeight: 700 }}>Attiva</Typography>
        : <Button variant="outlined" color="inherit" onClick={onActivate} sx={{ ...smallBtn, alignSelf: 'flex-start' }}>Rendi attiva</Button>}
      {plan.days.map((day, di) => (
        <Box key={day.name} sx={cardSx}>
          <Typography sx={{ ...titleSx, fontSize: '1.05rem', mb: 0.5 }}>{day.name}</Typography>
          {day.ex.map(([n, sr], ei) => (
            <Box key={n} sx={{ borderTop: ei ? '1px solid' : 0, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44 }}>
                <Typography sx={{ flex: 1, minWidth: 0 }}>{n}</Typography>
                <Typography color="text.secondary" sx={{ ...TABULAR, whiteSpace: 'nowrap' }}>{sr}</Typography>
              </Box>
              {edit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
                  <IconButton aria-label={`Sposta su ${n}`} disabled={ei === 0} onClick={() => move(di, ei, -1)} sx={{ width: 44, height: 44 }}><ArrowUpwardIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={`Sposta giù ${n}`} disabled={ei === day.ex.length - 1} onClick={() => move(di, ei, 1)} sx={{ width: 44, height: 44 }}><ArrowDownwardIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={`Modifica ${n}`} onClick={() => setSheet(`Modifica ${n}`)} sx={{ width: 44, height: 44 }}><EditOutlinedIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={`Elimina ${n}`} onClick={() => remove(di, ei)} sx={{ width: 44, height: 44, color: 'error.main' }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Box>
              )}
            </Box>
          ))}
          {edit ? (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Button startIcon={<AddIcon />} variant="outlined" color="inherit" onClick={() => setSheet('Aggiungi esercizio')} sx={smallBtn}>Aggiungi esercizio</Button>
              <Button color="error" onClick={() => setDays((days) => days.filter((_, i) => i !== di))} sx={{ ...smallBtn, px: 1.5 }}>Elimina giorno</Button>
            </Box>
          ) : (
            <Button variant="contained" onClick={() => onStart(di)} sx={{ ...smallBtn, mt: 1, boxShadow: 'none', fontWeight: 700 }}>Inizia</Button>
          )}
        </Box>
      ))}
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet}>
        <Typography color="text.secondary">Finto: nel prototipo qui non si scrive niente.</Typography>
      </Sheet>
    </Box>
  );
};

const SchedePage = ({ detail, setMany }) => {
  const [plans, setPlans] = useState(PLANS);
  const [activeId, setActiveId] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const planId = Number(detail('scheda'));
  const plan = plans.find((p) => p.id === planId);

  if (catalog) return <Catalog onBack={() => setCatalog(false)} />;
  if (plan) {
    return (
      <PlanPage
        key={plan.id}
        plan={plan}
        active={plan.id === activeId}
        onActivate={() => setActiveId(plan.id)}
        onBack={() => setMany({ scheda: null })}
        onStart={(di) => setMany({ s: 'prima', giorno: di, scheda: null })}
        onChange={(np) => setPlans((all) => all.map((p) => (p.id === np.id ? np : p)))}
      />
    );
  }
  const sorted = [...plans].sort((a, b) => (b.id === activeId) - (a.id === activeId));
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <PageTitle action={<Button variant="contained" onClick={() => setSheet(true)} sx={{ minHeight: 44, borderRadius: radius.lg, fontWeight: 700, boxShadow: 'none' }}>Nuova scheda</Button>}>Schede</PageTitle>
      {sorted.map((p) => (
        <ButtonBase key={p.id} onClick={() => setMany({ scheda: p.id })} sx={{ ...cardSx, display: 'flex', justifyContent: 'space-between', textAlign: 'left', minHeight: 64, width: '100%' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
            <Typography variant="body2" color="text.secondary">{p.days.length} giorni</Typography>
          </Box>
          {p.id === activeId && <Typography sx={{ px: 1.25, py: 0.25, borderRadius: radius.pill, bgcolor: 'success.main', color: '#fff', fontSize: 13, fontWeight: 700 }}>Attiva</Typography>}
        </ButtonBase>
      ))}
      <Box sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
        <NavRow title="Tutti gli esercizi" subtitle="Cerca nel catalogo" onClick={() => setCatalog(true)} />
      </Box>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Nuova scheda">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NEW_OPTIONS.map(([t, s]) => (
            <ButtonBase key={t} onClick={() => setSheet(false)} sx={{ ...cardSx, display: 'block', textAlign: 'left', minHeight: 60 }}>
              <Typography sx={{ fontWeight: 700 }}>{t}</Typography>
              <Typography variant="body2" color="text.secondary">{s}</Typography>
            </ButtonBase>
          ))}
        </Box>
      </Sheet>
    </Box>
  );
};

export default SchedePage;

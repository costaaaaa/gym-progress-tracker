// PROTOTIPO (da buttare): pagina Progressi (esercizi con dettaglio, volume, corpo)
import { useState } from 'react';
import { Box, Button, ButtonBase, Collapse, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import Chart from './Chart';
import { Back, Chip, Seg } from './ui';
import { cardSx, labelSx, titleSx } from './styles';
import { CHART, GROUPS, MUSCLES, SESSIONS, TREND, WEIGHT_SERIES } from './data';
import { fmt } from './numbers';
import { radius } from '../../theme/radius';
import { TABULAR } from '../../utils/fonts';

const RECOVERY = { ready: 'pronto', recovering: 'in recupero', fatigued: 'affaticato' };
const btn = { minHeight: 48, borderRadius: radius.lg, fontWeight: 600 };
const Stat = ({ l, v }) => (
  <Box sx={{ ...cardSx, p: 1.5, textAlign: 'center' }}>
    <Typography sx={{ ...TABULAR, fontWeight: 700 }}>{v}</Typography>
    <Typography variant="caption" color="text.secondary">{l}</Typography>
  </Box>
);

const ExerciseDetail = ({ ex, flags, onBack }) => {
  const [metric, setMetric] = useState('1RM stimato');
  const [table, setTable] = useState(false);
  const unit = metric === '1RM stimato' ? ' kg' : metric === 'Volume' ? ' kg' : '';
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Back onClick={onBack} />
        <Typography component="h1" sx={{ ...titleSx, fontSize: '1.3rem', fontWeight: 700, minWidth: 0 }} noWrap>{ex.name}</Typography>
      </Box>
      <Box sx={cardSx}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          {Object.keys(CHART).map((k) => <Chip key={k} on={metric === k} onClick={() => setMetric(k)}>{k}</Chip>)}
        </Box>
        <Chart values={CHART[metric]} height={130} unit={unit} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        <Stat l="Attuale" v={`${ex.rm} kg`} />
        <Stat l="Migliore" v={`${ex.rm + 2} kg`} />
        <Stat l="Sessioni" v="24" />
      </Box>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Grado di forza</Typography>
        <Typography sx={{ mt: 0.5, fontWeight: 600 }}>{flags.misure ? 'Intermedio · 1,2 volte il tuo peso' : 'Aggiungi il tuo peso per vedere il grado di forza'}</Typography>
      </Box>
      <Box sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
        <ButtonBase onClick={() => setTable((t) => !t)} aria-expanded={table} sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', minHeight: 52, px: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>Tabella delle percentuali</Typography>
          <ExpandMoreIcon sx={{ transform: table ? 'rotate(180deg)' : 'none' }} />
        </ButtonBase>
        <Collapse in={table}>
          <Box sx={{ px: 2, pb: 1.5 }}>
            {[100, 90, 80, 70, 60].map((p) => (
              <Box key={p} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderTop: '1px solid', borderColor: 'divider', ...TABULAR }}>
                <Typography>{p}%</Typography>
                <Typography>{fmt(Math.round(ex.rm * p) / 100)} kg</Typography>
                <Typography color="text.secondary">~{Math.max(1, Math.round(30 * (100 / p - 1)))} rip</Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Box>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Ultime sessioni</Typography>
        {SESSIONS.map(([d, s]) => (
          <Box key={d} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 1 }}>
            <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{d}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ ...TABULAR, textAlign: 'right' }}>{s}</Typography>
          </Box>
        ))}
      </Box>
      {flags.coach && <Button variant="outlined" color="inherit" sx={btn}>Chiedi al Coach</Button>}
    </Box>
  );
};

const Esercizi = ({ setMany }) => {
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [favs, setFavs] = useState(() => GROUPS.flatMap((g) => g.ex).filter((e) => e.fav).map((e) => e.id));
  const groups = GROUPS.map((g) => ({ ...g, ex: g.ex.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!favOnly || favs.includes(e.id))) })).filter((g) => g.ex.length);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ fontWeight: 600 }}>4 in miglioramento · 2 fermi · 1 in calo · 3 record</Typography>
      <TextField size="small" placeholder="Cerca un esercizio" value={q} onChange={(e) => setQ(e.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Cerca un esercizio' } }} />
      <Box><Chip on={favOnly} onClick={() => setFavOnly((f) => !f)}>Preferiti</Chip></Box>
      {groups.map((g) => (
        <Box key={g.name} sx={{ ...cardSx, p: 0, overflow: 'hidden' }}>
          <Typography sx={{ ...labelSx, px: 2, pt: 1.5, pb: 0.5 }}>{g.name}</Typography>
          {g.ex.map((e) => {
            const [arrow, label, color] = TREND[e.trend];
            return (
              <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                <ButtonBase onClick={() => setMany({ esercizio: e.id })} sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', textAlign: 'left', gap: 1, minHeight: 56, pl: 2, py: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{e.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={TABULAR}>1RM stimato {e.rm} kg</Typography>
                  </Box>
                  <Typography aria-label={label} sx={{ color, fontWeight: 700, fontSize: 20 }}>{arrow}</Typography>
                </ButtonBase>
                <ButtonBase aria-label={favs.includes(e.id) ? `Togli dai preferiti ${e.name}` : `Aggiungi ai preferiti ${e.name}`} onClick={() => setFavs((f) => (f.includes(e.id) ? f.filter((x) => x !== e.id) : [...f, e.id]))} sx={{ width: 44, height: 56 }}>
                  {favs.includes(e.id) ? <StarIcon sx={{ color: 'warning.text' }} /> : <StarBorderIcon sx={{ color: 'text.secondary' }} />}
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      ))}
      {!groups.length && <Typography color="text.secondary">Nessun esercizio.</Typography>}
    </Box>
  );
};

const Volume = ({ flags }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Volume settimana</Typography>
        <Typography sx={{ ...TABULAR, fontWeight: 700, fontSize: '1.2rem' }}>21.600 kg</Typography>
        <Typography variant="body2" sx={{ color: 'success.main' }}>+8% sulla precedente</Typography>
      </Box>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Serie</Typography>
        <Typography sx={{ ...TABULAR, fontWeight: 700, fontSize: '1.2rem' }}>62</Typography>
        <Typography variant="body2" color="text.secondary">prima 57</Typography>
      </Box>
    </Box>
    <Box sx={cardSx}>
      <Typography sx={labelSx}>Serie per muscolo</Typography>
      {MUSCLES.map(([n, v, st]) => (
        <Box key={n} sx={{ mt: 1.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{n}</Typography>
            <Typography color="text.secondary" sx={TABULAR}>{v} serie{flags.recupero ? ` · ${RECOVERY[st]}` : ''}</Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'background.subtle', border: '1px solid', borderColor: 'divider', mt: 0.5, overflow: 'hidden' }}>
            <Box sx={{ width: `${(v / 16) * 100}%`, height: '100%', bgcolor: flags.recupero ? `recovery.${st}` : 'text.secondary' }} />
          </Box>
        </Box>
      ))}
    </Box>
    {flags.cardio && (
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Cardio della settimana</Typography>
        <Typography sx={{ ...TABULAR, fontWeight: 700, fontSize: '1.2rem' }}>1 h 20 min · 21 km</Typography>
        <Typography variant="body2" color="text.secondary">2 sessioni</Typography>
      </Box>
    )}
  </Box>
);

const Corpo = () => {
  const [period, setPeriod] = useState('3m');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Button variant="contained" sx={{ ...btn, boxShadow: 'none', fontWeight: 700 }}>Nuova misura</Button>
      <Seg label="Periodo" value={period} onChange={setPeriod} options={[{ value: '1m', label: '1 mese' }, { value: '3m', label: '3 mesi' }, { value: '1a', label: '1 anno' }]} />
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Peso</Typography>
        <Typography sx={{ ...TABULAR, fontWeight: 700, fontSize: '1.2rem', mb: 1 }}>78,4 kg</Typography>
        <Chart values={WEIGHT_SERIES} height={110} unit=" kg" />
      </Box>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Composizione</Typography>
        {[['Massa grassa', '18,4 %'], ['Massa magra', '64,0 kg']].map(([l, v]) => (
          <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}><Typography>{l}</Typography><Typography sx={{ ...TABULAR, fontWeight: 600 }}>{v}</Typography></Box>
        ))}
      </Box>
      <Box sx={cardSx}>
        <Typography sx={labelSx}>Circonferenze</Typography>
        {[['Vita', '82 cm'], ['Petto', '101 cm'], ['Braccio', '36 cm'], ['Coscia', '58 cm']].map(([l, v]) => (
          <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}><Typography>{l}</Typography><Typography sx={{ ...TABULAR, fontWeight: 600 }}>{v}</Typography></Box>
        ))}
      </Box>
    </Box>
  );
};

const ProgressiPage = ({ values, flags, detail, set, setMany }) => {
  const ex = GROUPS.flatMap((g) => g.ex).find((e) => e.id === Number(detail('esercizio')));
  if (ex) return <ExerciseDetail ex={ex} flags={flags} onBack={() => setMany({ esercizio: null })} />;
  const tab = values.tab === 'corpo' && !flags.misure ? 'esercizi' : values.tab;
  const tabs = [{ value: 'esercizi', label: 'Esercizi' }, { value: 'volume', label: 'Volume' }, ...(flags.misure ? [{ value: 'corpo', label: 'Corpo' }] : [])];
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h1" sx={{ ...titleSx, fontSize: '1.4rem', fontWeight: 700 }}>Progressi</Typography>
      <Seg label="Sezione" value={tab} onChange={(v) => set('tab', v)} options={tabs} />
      {tab === 'esercizi' && <Esercizi setMany={setMany} />}
      {tab === 'volume' && <Volume flags={flags} />}
      {tab === 'corpo' && <Corpo />}
    </Box>
  );
};

export default ProgressiPage;

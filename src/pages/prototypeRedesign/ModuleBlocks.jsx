// PROTOTIPO (da buttare): blocchi dei moduli della Home, in misura piccola (una riga) e grande (card piena)
import { Box, Collapse, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { radius } from '../../theme/radius';
import { TITLE_FONT_FAMILY, TABULAR } from '../../utils/fonts';
import { LevelStreakBig, RecoveryBars } from './HomeParts';

export const MODULES = {
  livello: 'Livello e streak',
  gruppi: 'Gruppi',
  recupero: 'Recupero',
  peso: 'Peso',
  cardio: 'Cardio della settimana',
};

const WEIGHTS = [79.0, 78.9, 78.8, 78.7, 78.9, 78.6, 78.5, 78.6, 78.4];

const Spark = ({ height }) => {
  const min = Math.min(...WEIGHTS);
  const max = Math.max(...WEIGHTS);
  const pts = WEIGHTS.map((v, i) => `${(i / (WEIGHTS.length - 1)) * 100},${100 - ((v - min) / (max - min)) * 100}`).join(' ');
  return (
    <Box component="svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" sx={{ width: '100%', height, color: 'primary.text', display: 'block' }}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </Box>
  );
};

const RECOVERY = [
  ['Petto', 'ready', 'pronto'], ['Dorsali', 'recovering', 'in recupero'], ['Spalle', 'ready', 'pronte'],
  ['Quadricipiti', 'fatigued', 'affaticati'], ['Bicipiti', 'recovering', 'in recupero'], ['Core', 'ready', 'pronto'],
];
const CARDIO_DAYS = [['L', 0], ['M', 35], ['M', 0], ['G', 30], ['V', 0], ['S', 0], ['D', 0]];

// Dato di una riga, piccola
const SMALL = {
  livello: 'Livello 12 · streak di 4 settimane',
  gruppi: 'Palestra Rossi · sei 2° questa settimana',
  recupero: '3 muscoli pronti · 2 in recupero',
  peso: '78,4 kg · −0,6 kg in 30 giorni',
  cardio: '2 sessioni · 1 h 05 questa settimana',
};

export const Big = ({ id, rich }) => {
  if (rich && id === 'livello') return <LevelStreakBig />;
  if (rich && id === 'recupero') return <RecoveryBars />;
  if (id === 'livello') {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ fontWeight: 700 }}>Livello 12</Typography>
          <Typography variant="body2" color="text.secondary" sx={TABULAR}>1.240 / 1.500 punti</Typography>
        </Box>
        <LinearProgress variant="determinate" value={83} aria-label="Avanzamento del livello" sx={{ height: 8, borderRadius: 4 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>Streak: 4 settimane di fila con l'obiettivo raggiunto</Typography>
      </Box>
    );
  }
  if (id === 'gruppi') {
    return (
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {[['1', 'Marta', '5 allenamenti'], ['2', 'Tu', '4 allenamenti'], ['3', 'Luca', '3 allenamenti']].map(([n, name, v]) => (
          <Box component="li" key={n} sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.75, borderRadius: radius.md, bgcolor: name === 'Tu' ? 'background.mine' : 'transparent' }}>
            <Typography sx={{ fontWeight: name === 'Tu' ? 700 : 500 }}>{n}. {name}</Typography>
            <Typography color="text.secondary">{v}</Typography>
          </Box>
        ))}
      </Box>
    );
  }
  if (id === 'recupero') {
    return (
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {RECOVERY.map(([name, state, text]) => (
          <Box component="li" key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '50%', flex: '0 0 auto', bgcolor: `recovery.${state}` }} />
            <Typography variant="body2"><b>{name}</b> {text}</Typography>
          </Box>
        ))}
      </Box>
    );
  }
  if (id === 'peso') {
    return (
      <Box>
        <Typography sx={{ ...TABULAR, fontWeight: 700, fontSize: '1.6rem' }}>78,4 kg</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>−0,6 kg in 30 giorni</Typography>
        <Spark height={96} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, alignItems: 'end' }}>
      {CARDIO_DAYS.map(([d, min], i) => (
        <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ ...TABULAR, fontSize: 11, color: 'text.secondary', minHeight: 14 }}>{min ? `${min}'` : ''}</Box>
          <Box aria-hidden="true" sx={{ width: '60%', height: min ? Math.max(8, min * 1.4) : 4, borderRadius: 1, bgcolor: min ? 'primary.main' : 'divider' }} />
          <Typography variant="caption" color="text.secondary">{d}</Typography>
        </Box>
      ))}
    </Box>
  );
};

const ModuleCard = ({ id, size, rich = false }) => {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const big = size === 'big';
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: radius.xxl, px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 40 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: TITLE_FONT_FAMILY, fontWeight: 600, fontSize: big ? '1rem' : '0.95rem' }}>{MODULES[id]}</Typography>
          {!big && <Typography variant="body2" color="text.secondary" sx={TABULAR}>{SMALL[id]}</Typography>}
        </Box>
        {!big && id === 'livello' && <LocalFireDepartmentIcon aria-hidden="true" sx={{ fontSize: 26, color: 'warning.text', flex: '0 0 auto' }} />}
        {!big && id === 'peso' && <Box sx={{ width: 56, flex: '0 0 auto' }}><Spark height={24} /></Box>}
        <ChevronRightIcon sx={{ color: 'text.secondary', flex: '0 0 auto' }} />
      </Box>
      <Collapse in={big} timeout={reduce ? 0 : 250} unmountOnExit>
        <Box sx={{ pt: 1.5, pb: 0.5 }}><Big id={id} rich={rich} /></Box>
      </Collapse>
    </Box>
  );
};

export default ModuleCard;

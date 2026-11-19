// PROTOTIPO (da buttare): prima dell'allenamento, giorno scelto con etichette e strumenti della serie
import { useState } from 'react';
import { Box, Button, ButtonBase, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Sheet from './Sheet';
import { Chip, Toggle } from './ui';
import { DAYS } from './data';
import { cardSx, titleSx } from './styles';
import { radius } from '../../theme/radius';
import { TABULAR } from '../../utils/fonts';

const TOOLS = [['timer', 'Timer di recupero'], ['suggerito', 'Peso suggerito'], ['nota', 'Nota per serie'], ['dischi', 'Dischi'], ['rir', 'RIR / RPE']];

const PrimaScreen = ({ tools, setTool, giorno, onExit, onStart }) => {
  const [day, setDay] = useState(giorno);
  const [sheet, setSheet] = useState(false);
  const on = TOOLS.filter(([k]) => tools[k]).length;
  return (
    <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, height: 52 }}>
        <IconButton aria-label="Esci" onClick={onExit} sx={{ width: 44, height: 44 }}><CloseIcon /></IconButton>
        <Typography sx={{ ...titleSx, fontSize: '1.1rem' }}>Push Pull Legs</Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box role="group" aria-label="Giorno" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {DAYS.map((d, i) => (
            <Chip key={d.name} on={day === i} onClick={() => setDay(i)}>{d.name}{i === 1 ? ' · oggi' : ''}</Chip>
          ))}
        </Box>
        <Box component="ul" sx={{ ...cardSx, listStyle: 'none', m: 0, py: 0.5 }}>
          {DAYS[day].ex.map(([name, sr], i) => (
            <Box component="li" key={name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 1.1, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
              <Typography>{name}</Typography>
              <Typography color="text.secondary" sx={{ ...TABULAR, flex: '0 0 auto' }}>{sr}</Typography>
            </Box>
          ))}
        </Box>
        <ButtonBase onClick={() => setSheet(true)} sx={{ ...cardSx, py: 1.25, display: 'flex', justifyContent: 'flex-start', gap: 1.5, textAlign: 'left' }}>
          <TuneIcon sx={{ color: 'text.secondary' }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>Strumenti della serie</Typography>
            <Typography variant="body2" color="text.secondary">{on} accesi su {TOOLS.length}</Typography>
          </Box>
          <ChevronRightIcon sx={{ color: 'text.secondary' }} />
        </ButtonBase>
      </Box>
      <Box sx={{ flex: '0 0 auto', p: 2 }}>
        <Button variant="contained" fullWidth size="large" onClick={onStart} sx={{ py: 2, fontSize: '1.2rem', fontWeight: 700, borderRadius: radius.xl, boxShadow: 'none' }}>Inizia</Button>
      </Box>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Strumenti della serie">
        {TOOLS.map(([k, label]) => <Toggle key={k} label={label} checked={tools[k]} onChange={(v) => setTool(k, v)} />)}
      </Sheet>
    </Box>
  );
};

export default PrimaScreen;

// PROTOTIPO (da buttare): menu del pulsante centrale
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import StraightenIcon from '@mui/icons-material/Straighten';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Sheet from './Sheet';
import { radius } from '../../theme/radius';

const Row = ({ Icon, label, onClick }) => (
  <ButtonBase onClick={onClick} sx={{ width: '100%', justifyContent: 'flex-start', gap: 1.5, px: 1, minHeight: 52, borderRadius: radius.lg, textAlign: 'left' }}>
    <Icon sx={{ color: 'text.secondary' }} />
    <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
  </ButtonBase>
);

const CenterMenu = ({ open, onClose, onStart, bozza, moduli }) => (
  <Sheet open={open} onClose={onClose} title="Cosa vuoi fare">
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={onStart} sx={{ py: 1.75, mb: 1, fontWeight: 700, borderRadius: radius.xl, justifyContent: 'flex-start', textAlign: 'left' }}>
        {bozza ? 'Riprendi allenamento · Giorno B, serie 7 di 18' : 'Inizia allenamento'}
      </Button>
      <Row Icon={EditCalendarOutlinedIcon} label="Registra allenamento passato" onClick={onClose} />
      {moduli && <Row Icon={DirectionsRunIcon} label="Cardio" onClick={onClose} />}
      {moduli && <Row Icon={StraightenIcon} label="Nuova misura" onClick={onClose} />}
      {moduli && <Row Icon={AutoAwesomeOutlinedIcon} label="Chiedi al Coach" onClick={onClose} />}
    </Box>
  </Sheet>
);

export default CenterMenu;

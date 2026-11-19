// PROTOTIPO (da buttare): barra in basso Home · Schede · (centrale) · Storico · Progressi
import { Box, ButtonBase } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import HistoryIcon from '@mui/icons-material/History';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LogoMark from '../../components/LogoMark';

const Item = ({ label, Icon, active, onClick }) => (
  <ButtonBase
    onClick={onClick}
    disableRipple
    aria-current={active ? 'page' : undefined}
    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '100%', borderRadius: 0, minWidth: 0, '&.Mui-focusVisible': { outlineOffset: '-4px' } }}
  >
    <Icon sx={{ fontSize: 21, color: active ? 'primary.text' : 'text.secondary' }} />
    <Box component="span" sx={{ fontSize: '10.5px', whiteSpace: 'nowrap', fontWeight: active ? 700 : 500, color: active ? 'primary.text' : 'text.secondary' }}>{label}</Box>
  </ButtonBase>
);

const BottomBar = ({ tab, onTab, logo, onCenter, open }) => {
  const theme = useTheme();
  return (
    <Box
      component="nav"
      aria-label="Navigazione principale"
      sx={{ position: 'relative', zIndex: 1, flex: '0 0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 68px 1fr 1fr', height: 64, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Item label="Home" Icon={HomeOutlinedIcon} active={tab === 'home'} onClick={() => onTab('home')} />
      <Item label="Schede" Icon={CalendarTodayOutlinedIcon} active={tab === 'schede'} onClick={() => onTab('schede')} />
      <ButtonBase
        onClick={onCenter}
        disableRipple
        aria-label="Cosa vuoi fare"
        aria-expanded={open}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 0, '&.Mui-focusVisible': { outlineOffset: '-4px' } }}
      >
        <Box
          sx={{
            width: 56, height: 56, borderRadius: '50%', bgcolor: 'primary.main', color: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'translateY(-14px)', boxShadow: `0 8px 18px ${alpha(theme.palette.primary.main, 0.4)}`, border: '4px solid', borderColor: 'background.default',
          }}
        >
          {open ? <CloseIcon sx={{ fontSize: 26 }} /> : logo === 'centro' ? <LogoMark width={26} /> : <PlayArrowIcon sx={{ fontSize: 26 }} />}
        </Box>
      </ButtonBase>
      <Item label="Storico" Icon={HistoryIcon} active={tab === 'storico'} onClick={() => onTab('storico')} />
      <Item label="Progressi" Icon={EqualizerIcon} active={tab === 'progressi'} onClick={() => onTab('progressi')} />
    </Box>
  );
};

export default BottomBar;

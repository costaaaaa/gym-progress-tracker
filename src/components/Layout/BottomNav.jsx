import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, useMediaQuery, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import HistoryIcon from '@mui/icons-material/History';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LogoMark from '../LogoMark';
import CenterFan from './CenterFan';
import { BAR_HEIGHT, CIRCLE } from './barMetrics';
import { useCenterActions } from '../../hooks/useCenterActions';

// Voce di navigazione standard (icona + etichetta), come link/bottone accessibile
// (component=RouterLink su ButtonBase: focus da tastiera, aria-current sulla voce attiva).
// Le voci riempiono la cella fino al bordo dello schermo: il contorno del focus sta dentro, non fuori
const FOCUS_INSIDE = { '&.Mui-focusVisible': { outlineOffset: '-4px' } };

const NavItem = ({ path, label, Icon, active }) => (
  <ButtonBase
    component={RouterLink}
    to={path}
    disableRipple
    aria-current={active ? 'page' : undefined}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
      height: '100%',
      borderRadius: 0,
      ...FOCUS_INSIDE,
    }}
  >
    <Icon sx={{ fontSize: 21, color: active ? 'primary.text' : 'text.secondary' }} />
    <Box
      component="span"
      sx={{ fontSize: '10.5px', fontWeight: active ? 700 : 500, color: active ? 'primary.text' : 'text.secondary' }}
    >
      {label}
    </Box>
  </ButtonBase>
);

// Barra di navigazione mobile fissa in basso: Home / Schede / pulsante centrale (apre il ventaglio:
// Inizia o Riprendi, Registra, Misura) / Storico / Progressi. Sostituisce il menu hamburger di Navbar.jsx su mobile:
// qui è sempre visibile durante l'uso dell'app. Il Profilo si apre dall'avatar in alto.
const BottomNav = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isLoggedIn, emailState } = useAuth();
  const actions = useCenterActions();
  const [fanOpen, setFanOpen] = useState(false);
  const centerRef = useRef(null);
  const wasOpen = useRef(false);

  // A ventaglio chiuso il fuoco torna al pulsante centrale (Safari e Firefox su Mac non lo danno al clic)
  useEffect(() => {
    if (wasOpen.current && !fanOpen) centerRef.current?.focus();
    wasOpen.current = fanOpen;
  }, [fanOpen]);

  // Il ventaglio non sopravvive a un cambio di indirizzo (indietro del browser, swipe) né al passaggio al desktop
  useEffect(() => { setFanOpen(false); }, [location.key, isMobile]);

  // Con l'app bloccata dalla conferma dell'email le voci porterebbero a pagine che rispondono 403
  if (!isMobile || !isLoggedIn || emailState?.blocked === true) return null;

  // La modalità Focus vive fuori dal Layout (full screen, senza Navbar): niente barra lì.
  if (location.pathname === '/focus') return null;

  const isActive = (path) => location.pathname === path;
  // Le schede hanno una pagina ciascuna: «Schede» resta attiva anche su /schede/<id>
  const plansActive = isActive('/schede') || location.pathname.startsWith('/schede/');

  return (
    <Box
      component="nav"
      aria-label={t('nav.main_aria')}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: { xs: 'grid', md: 'none' },
        gridTemplateColumns: '1fr 1fr 68px 1fr 1fr',
        height: `${BAR_HEIGHT}px`,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <NavItem path="/" label={t('nav.home')} Icon={HomeOutlinedIcon} active={isActive('/')} />
      <NavItem path="/schede" label={t('nav.plans')} Icon={CalendarTodayOutlinedIcon} active={plansActive} />

      <ButtonBase
        ref={centerRef}
        onClick={() => setFanOpen(true)}
        disableRipple
        aria-label={t('nav.center_aria')}
        aria-haspopup="dialog"
        aria-expanded={fanOpen}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 0, ...FOCUS_INSIDE }}
      >
        <Box
          sx={{
            width: CIRCLE.main,
            height: CIRCLE.main,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'common.white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translateY(-14px)',
            boxShadow: `0 8px 18px ${alpha(theme.palette.primary.main, 0.4)}`,
            border: '4px solid',
            borderColor: 'background.default',
          }}
        >
          <LogoMark width={26} />
        </Box>
      </ButtonBase>

      <NavItem path="/storico" label={t('nav.history')} Icon={HistoryIcon} active={isActive('/storico')} />
      <NavItem path="/dashboard" label={t('nav.progress')} Icon={EqualizerIcon} active={isActive('/dashboard')} />

      <CenterFan open={fanOpen} onClose={() => setFanOpen(false)} items={actions} />
    </Box>
  );
};

export default BottomNav;

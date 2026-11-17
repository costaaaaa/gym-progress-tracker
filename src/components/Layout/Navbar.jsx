import { useState, useEffect, useRef } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, useMediaQuery, IconButton, useTheme, Tooltip, CircularProgress } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { safeNext } from '../../utils/safeNext';
import { useTranslation } from 'react-i18next';
import { visuallyHidden } from '@mui/utils';
import { BELOW_360 } from '../../theme/narrowScreens';
import { isAuthPath, stripLangPrefix, useLocalizedPath } from '../../i18n/paths';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import LogoMark from '../LogoMark';

// Voci del centro nav desktop: Home / Allenamenti / Dashboard / Gruppi.
// Su mobile la navigazione vive in BottomNav.jsx (Home/Allenamenti/Focus/Dashboard/Profilo);
// qui restano solo logo, toggle tema e avatar — "Profilo" non ha un link testuale,
// l'avatar è l'unico ingresso, sia su desktop che su mobile.
// Bottoni di accesso: sui telefoni meno spazio ai lati, da sm il padding del tema (18px)
const SIGN_IN_PX = { xs: 1, sm: '18px' };

const navItems = [
  { label: 'nav.home', path: '/' },
  { label: 'nav.workouts', path: '/workouts' },
  { label: 'nav.dashboard', path: '/dashboard' },
  { label: 'nav.groups', path: '/gruppi' },
];


const Navbar = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, toggleThemeMode } = useThemeMode();

  // L'altezza della riga dei controlli (sale se vanno a capo) la legge la scena della landing per stare sotto la barra
  const toolbarRef = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--navbar-height', `${toolbarRef.current.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(toolbarRef.current);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--navbar-height');
    };
  }, []);

  // Utilizziamo il context invece della logica locale
  const { isLoggedIn, user, loading, emailState } = useAuth();
  // Con l'app bloccata dalla conferma dell'email le voci porterebbero a pagine che rispondono 403
  const showAppNav = isLoggedIn && emailState?.blocked !== true;

  // Accedi e Registrati conservano la pagina a cui tornare: il ?next= già presente
  // su login e registrazione, oppure il link di invito che si sta guardando.
  const barePath = stripLangPrefix(location.pathname);
  const onAuthPage = isAuthPath(location.pathname);
  // Pagine di accesso: il bottone rosso è quello del modulo, la Navbar resta in testo
  const onAccessPage = onAuthPage || barePath === '/forgot-password' || barePath === '/reset-password';
  const authNext = onAuthPage
    ? safeNext(location.search)
    : location.pathname.startsWith('/entra') ? location.pathname + location.search : '/';
  const withNext = (path) => (authNext === '/' ? localizedPath(path) : `${localizedPath(path)}?next=${encodeURIComponent(authNext)}`);

  // Stato locale per tracciare se l'autenticazione è stata verificata
  const [authVerified, setAuthVerified] = useState(false);

  // Aggiorniamo lo stato locale quando cambia lo stato di loading
  useEffect(() => {
    if (!loading) {
      setAuthVerified(true);
    }
  }, [loading]);

  const isActive = (path) => {
    // /gruppi resta attivo anche dentro un gruppo (/gruppi/12)
    return path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const onProfilePage = location.pathname === '/profilo';
  const initials = user?.username ? user.username.charAt(0).toUpperCase() : '?';

  return (
    <AppBar position="sticky" elevation={0} sx={{ overflowX: 'hidden' }}>
      <Toolbar
        ref={toolbarRef}
        sx={{
          // Telefoni: riga che va a capo se i controlli non stanno accanto al marchio (spaziatura del testo)
          display: { xs: 'flex', sm: 'grid' },
          flexWrap: 'wrap',
          rowGap: 0.5,
          gridTemplateColumns: { sm: '1fr auto', md: '1fr auto 1fr' },
          alignItems: 'center',
          minHeight: '64px !important',
          maxWidth: '1180px',
          mx: 'auto',
          width: '100%',
          px: { xs: 2, md: '32px' },
        }}
      >
        {/* Sinistra: logo */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            justifySelf: 'start',
            cursor: 'pointer',
            textDecoration: 'none',
            color: 'text.primary',
          }}
          component={RouterLink}
          to={localizedPath('/')}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogoMark width={20} color={theme.palette.common.white} />
          </Box>
          <Typography
            sx={{
              fontFamily: TITLE_FONT_FAMILY,
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
              [BELOW_360]: visuallyHidden,
            }}
          >
            LiftIndex
          </Typography>
        </Box>

        {/* Centro: nav desktop, nascosta su mobile (su mobile la navigazione è in BottomNav) */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, justifySelf: 'center' }}>
            {authVerified && showAppNav && navItems.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                disableRipple
                sx={{
                  minWidth: 0,
                  px: 0,
                  py: 1,
                  fontSize: 14,
                  fontWeight: isActive(item.path) ? 600 : 500,
                  color: isActive(item.path) ? 'primary.text' : 'text.secondary',
                  borderRadius: 0,
                  borderBottom: '2px solid',
                  borderColor: isActive(item.path) ? 'primary.main' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: 'primary.text',
                  },
                }}
              >
                {t(item.label)}
              </Button>
            ))}
          </Box>
        )}

        {/* Destra: toggle tema, avatar / auth — stessa struttura su mobile e desktop */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifySelf: 'end', ml: { xs: 'auto', sm: 0 } }}>
          <Tooltip title={mode === 'light' ? t('nav.dark_mode') : t('nav.light_mode')}>
            <IconButton
              onClick={toggleThemeMode}
              size="small"
              sx={{
                width: 40,
                height: 40,
                ml: 1,
                color: 'text.secondary',
                bgcolor: 'navToggle.bg',
                '&:hover': { bgcolor: 'navToggle.hover' },
              }}
            >
              {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {authVerified && showAppNav && (
            <Tooltip title={t('nav.profile')}>
              <IconButton
                component={RouterLink}
                to="/profilo"
                sx={{
                  p: 0,
                  boxShadow: onProfilePage ? `0 0 0 2px ${theme.palette.common.white}, 0 0 0 4px ${theme.palette.primary.main}` : 'none',
                }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: 'ink',
                    color: 'onInk',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: TITLE_FONT_FAMILY,
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          )}

          {!isLoggedIn && loading && (
            <CircularProgress size={22} sx={{ color: 'text.secondary' }} />
          )}

          {/* Sulla pagina di accesso o di registrazione non si ripete il bottone della pagina stessa */}
          {authVerified && !isLoggedIn && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>
              {barePath !== '/login' && (
                <Button
                  component={RouterLink}
                  to={withNext('/login')}
                  sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 14, px: SIGN_IN_PX }}
                >
                  {t('nav.login')}
                </Button>
              )}
              {barePath !== '/register' && (
                <Button
                  variant={onAccessPage ? 'text' : 'contained'}
                  component={RouterLink}
                  to={withNext('/register')}
                  sx={onAccessPage ? { color: 'text.secondary', fontWeight: 500, fontSize: 14, px: SIGN_IN_PX } : { fontSize: 14, px: SIGN_IN_PX }}
                >
                  {t('nav.register')}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;

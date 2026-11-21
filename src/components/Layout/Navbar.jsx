import { useState, useEffect, useRef } from 'react';
import { alpha } from '@mui/material/styles';
import { AppBar, Toolbar, Typography, Button, ButtonGroup, Box, Avatar, useMediaQuery, IconButton, useTheme, Tooltip, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { safeNext } from '../../utils/safeNext';
import { useTranslation } from 'react-i18next';
import { visuallyHidden } from '@mui/utils';
import { BELOW_360 } from '../../theme/narrowScreens';
import { isAuthPath, stripLangPrefix, useLocalizedPath } from '../../i18n/paths';
import { TITLE_FONT_FAMILY } from '../../utils/fonts';
import LogoMark from '../LogoMark';
import { useCenterActions, centerActionProps } from '../../hooks/useCenterActions';

// Voci del centro nav desktop: Home / Schede / Storico / Progressi; a destra il pulsante diviso
// «Inizia allenamento ▾», il tema e l'avatar. Su mobile la navigazione vive in BottomNav.jsx
// (Home/Schede/pulsante centrale/Storico/Progressi); qui restano solo il nome, il toggle tema e l'avatar —
// "Profilo" non ha un link testuale, l'avatar è l'unico ingresso, sia su desktop che su mobile.
// Bottoni di accesso: sui telefoni meno spazio ai lati, da sm il padding del tema (18px)
const SIGN_IN_PX = { xs: 1, sm: '18px' };

const navItems = [
  { label: 'nav.home', path: '/' },
  { label: 'nav.plans', path: '/schede' },
  { label: 'nav.history', path: '/storico' },
  { label: 'nav.progress', path: '/dashboard' },
];


// `redBar`: l'apertura della Home è rossa (lo dice il Layout). La barra segue solo sul telefono dentro l'app
const Navbar = ({ redBar = false }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const localizedPath = useLocalizedPath();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, toggleThemeMode } = useThemeMode();
  const actions = useCenterActions();
  const mainAction = actions.find((action) => action.main);
  const [moreAnchor, setMoreAnchor] = useState(null);

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
    return path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const phoneApp = isMobile && showAppNav;
  const onRed = phoneApp && redBar;
  const onProfilePage = location.pathname === '/profilo';
  const initials = user?.username ? user.username.charAt(0).toUpperCase() : '?';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        overflowX: 'hidden',
        ...(onRed && {
          background: theme.palette.primary.main,
          color: theme.palette.common.white,
          borderBottom: 'none',
          // Sul rosso il contorno scuro del tema dà 3,2 : 1: qui è bianco (5,5 : 1)
          '& .Mui-focusVisible': { outline: `2px solid ${theme.palette.common.white}` },
        }),
      }}
    >
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
            color: onRed ? 'inherit' : 'text.primary',
          }}
          component={RouterLink}
          to={localizedPath('/')}
        >
          {/* Sul telefono, dentro l'app, il simbolo sta nel pulsante centrale della barra in basso: qui solo il nome */}
          {!phoneApp && (
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
          )}
          <Typography
            sx={{
              fontFamily: TITLE_FONT_FAMILY,
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
              ...(phoneApp ? {} : { [BELOW_360]: visuallyHidden }),
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
                aria-current={isActive(item.path) ? 'page' : undefined}
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
          {/* Desktop: pulsante diviso. «Inizia allenamento» («Riprendi» con uno a metà) e, a parte, il menu delle altre azioni */}
          {!isMobile && authVerified && showAppNav && (
            <>
              <ButtonGroup variant="contained" disableElevation>
                <Button component={RouterLink} to={mainAction.to} startIcon={<mainAction.Icon />} sx={{ fontSize: 14 }}>
                  {mainAction.label}
                </Button>
                <Button
                  aria-label={t('nav.more_actions')}
                  aria-haspopup="menu"
                  aria-expanded={moreAnchor ? 'true' : 'false'}
                  onClick={(event) => setMoreAnchor(event.currentTarget)}
                  sx={{ px: 0.5, minWidth: 40 }}
                >
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>
              <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
                {actions.filter((action) => !action.main).map((action) => (
                  <MenuItem key={action.key} {...centerActionProps(action, () => setMoreAnchor(null))}>
                    <ListItemIcon><action.Icon fontSize="small" /></ListItemIcon>
                    <ListItemText>{action.label}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
          <Tooltip title={mode === 'light' ? t('nav.dark_mode') : t('nav.light_mode')}>
            <IconButton
              onClick={toggleThemeMode}
              size="small"
              sx={{
                width: 40,
                height: 40,
                ml: 1,
                ...(onRed
                  ? { color: 'common.white', bgcolor: 'transparent', '&:hover': { bgcolor: (theme) => alpha(theme.palette.common.white, 0.16) } }
                  : { color: 'text.secondary', bgcolor: 'navToggle.bg', '&:hover': { bgcolor: 'navToggle.hover' } }),
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
                aria-current={onProfilePage ? 'page' : undefined}
                sx={{
                  p: 0,
                  boxShadow: onProfilePage ? `0 0 0 2px ${theme.palette.common.white}, 0 0 0 4px ${theme.palette.primary.main}` : 'none',
                }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: onRed ? 'common.white' : 'ink',
                    color: onRed ? 'primary.main' : 'onInk',
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

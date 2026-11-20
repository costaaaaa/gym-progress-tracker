import { Container, Box, Link, Typography } from '@mui/material';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageHint from './LanguageHint';
import { radius } from '../../theme/radius';
import { isEnPath, isAccessPath, stripLangPrefix, withLangPrefix, legalPaths, blogPaths, plansPath } from '../../i18n/paths';
import { setLanguageChoice } from '../../i18n';
import EmailStrip from '../EmailVerification/EmailStrip';
import EmailGate from '../EmailVerification/EmailGate';
import InterestsGate from '../Modules/InterestsGate';
import EmailBlockedScreen from '../EmailVerification/EmailBlockedScreen';

const MAIN_ID = 'main-content';

// Primo elemento raggiungibile con Tab: fuori dallo schermo finché non ha il focus. Il clic sposta il focus
// sul <main> senza toccare la rotta (un href con #ancora lascerebbe una voce in più nella cronologia).
const skipLinkSx = {
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 2000,
  px: 2,
  py: 1,
  borderRadius: radius.sm,
  border: '1px solid',
  borderColor: 'text.primary',
  bgcolor: 'background.paper',
  fontWeight: 600,
  transform: 'translateY(-200%)',
  '&:focus': { transform: 'none' },
};

const Layout = () => {
  // Utilizziamo il context di autenticazione - questo forza il re-render quando cambia lo stato di autenticazione
  const { isLoggedIn, emailState } = useAuth();
  const { t, i18n } = useTranslation();
  const { pathname, search } = useLocation();
  const otherLang = isEnPath(pathname) ? 'it' : 'en';
  // Dal giorno 8 senza email confermata, al posto di ogni pagina dell'app c'è la schermata di conferma (le pagine di accesso restano)
  const blocked = isLoggedIn && emailState?.blocked === true && !isAccessPath(pathname);

  return (
    // Solo per gli ospiti: serve al campo pieno della home (100cqw); i Safari più vecchi trattavano il container
    // come riferimento dei position: fixed, e le pagine con login ne hanno (BottomNav, Snackbar).
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', containerType: isLoggedIn ? 'normal' : 'inline-size' }}>
      <Link
        href={`#${MAIN_ID}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
        sx={skipLinkSx}
      >
        {t('nav.skip_to_content')}
      </Link>
      {!isLoggedIn && <LanguageHint />}
      <Navbar />
      <EmailStrip />
      <Container
        component="main"
        id={MAIN_ID}
        tabIndex={-1}
        disableGutters
        sx={{
          mt: 4,
          mb: isLoggedIn ? 10 : 4,
          flexGrow: 1,
          maxWidth: { xs: '100%', md: '1180px' },
          px: { xs: 2, md: '32px' },
          '&:focus': { outline: 'none' },
        }}
      >
        {blocked ? <EmailBlockedScreen /> : <Outlet />}
      </Container>
      <Box
        component="footer"
        sx={{ textAlign: 'center', pb: { xs: isLoggedIn ? 10 : 2, md: 2 }, px: 2 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 14 }}>
          <Link href={legalPaths(i18n.language).privacy} color="inherit" underline="hover">{t('footer.privacy')}</Link>
          {' · '}
          <Link href={legalPaths(i18n.language).terms} color="inherit" underline="hover">{t('footer.terms')}</Link>
          {!isLoggedIn && (
            <>
              {/* Pagine PHP del blog, fuori dalla SPA: link normali, non del router */}
              {' · '}
              <Link href={blogPaths(i18n.language).calculator} color="inherit" underline="hover">{t('footer.calculator')}</Link>
              {' · '}
              <Link href={blogPaths(i18n.language).mcp} color="inherit" underline="hover">{t('footer.mcp')}</Link>
              {' · '}
              <Link href={plansPath(i18n.language)} color="inherit" underline="hover">{t('footer.plans')}</Link>
              {' · '}
              <Link
                component={RouterLink}
                to={withLangPrefix(stripLangPrefix(pathname), otherLang) + search}
                lang={otherLang}
                onClick={() => setLanguageChoice(otherLang)}
                color="inherit"
                underline="hover"
              >
                {t('footer.switch_language')}
              </Link>
            </>
          )}
        </Typography>
      </Box>
      <EmailGate />
      <InterestsGate />
      <BottomNav />
    </Box>
  );
};

export default Layout;
import { Container, Box, Link, Typography } from '@mui/material';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageHint from './LanguageHint';
import { isEnPath, stripLangPrefix, withLangPrefix } from '../../i18n/paths';
import { setLanguageChoice } from '../../i18n';

const Layout = () => {
  // Utilizziamo il context di autenticazione - questo forza il re-render quando cambia lo stato di autenticazione
  const { isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const otherLang = isEnPath(pathname) ? 'it' : 'en';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container
        component="main"
        disableGutters
        sx={{
          mt: 4,
          mb: isLoggedIn ? 10 : 4,
          flexGrow: 1,
          maxWidth: { xs: '100%', md: '1180px' },
          px: { xs: 2, md: '32px' },
        }}
      >
        {!isLoggedIn && <LanguageHint />}
        <Outlet />
      </Container>
      <Box
        component="footer"
        sx={{ textAlign: 'center', pb: { xs: isLoggedIn ? 10 : 2, md: 2 }, px: 2 }}
      >
        <Typography variant="caption" color="text.secondary">
          <Link href="/privacy.html" color="inherit" underline="hover">{t('footer.privacy')}</Link>
          {' · '}
          <Link href="/termini.html" color="inherit" underline="hover">{t('footer.terms')}</Link>
          {!isLoggedIn && (
            <>
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
      <BottomNav />
    </Box>
  );
};

export default Layout;